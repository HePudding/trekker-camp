# SPDX-FileCopyrightText: syuilo and misskey-project
# SPDX-License-Identifier: AGPL-3.0-only

"""Run on Linux with: python3 scripts/deploy.test.py -v."""

import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest


ROOT = Path(__file__).resolve().parent.parent
CODE_REPO = "https://github.com/HePudding/trekker-camp.git"
ASSETS_REPO = "https://github.com/HePudding/trekker-camp-assets.git"
CLOUDFLARE_TEST_TOKEN = "test-cloudflare-token".ljust(40, "x")


class DeployTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="camp-deploy-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.env = {
            **os.environ,
            "SCRIPT": str(ROOT / "scripts/deploy.sh"),
            "TEST_ROOT": str(self.root),
            "TEST_CF_TOKEN": CLOUDFLARE_TEST_TOKEN,
            "TMPDIR": str(self.root),
            "GIT_CONFIG_GLOBAL": "/dev/null",
            "GIT_CONFIG_SYSTEM": "/dev/null",
            "GIT_AUTHOR_NAME": "Deployment test",
            "GIT_AUTHOR_EMAIL": "deploy@example.invalid",
            "GIT_COMMITTER_NAME": "Deployment test",
            "GIT_COMMITTER_EMAIL": "deploy@example.invalid",
        }
        for name in ("GH_TOKEN", "GITHUB_TOKEN", "CAMP_GH_TOKEN", "CLOUDFLARE_API_TOKEN"):
            self.env.pop(name, None)

    def shell(self, body, success=True):
        result = subprocess.run(
            ["bash", "-c", 'set -Eeuo pipefail\nsource "$SCRIPT"\ncamp_dir="$TEST_ROOT/checkout"\nresolve_storage\n' + body],
            env=self.env, text=True, capture_output=True, timeout=30,
        )
        if success:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        return result

    def git(self, repo, *args):
        return subprocess.check_output(
            ["git", "-C", str(repo), *args], env=self.env,
            text=True, stderr=subprocess.PIPE,
        ).strip()

    def repository(self, name, files):
        repo = self.root / name
        repo.mkdir()
        self.git(repo, "init", "--initial-branch=master")
        for name, content in files.items():
            target = repo / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content)
        self.git(repo, "add", ".")
        self.git(repo, "commit", "-m", "Initial fixture")
        return repo

    def redirect(self, source, url):
        self.env.update({
            "GIT_CONFIG_COUNT": "1",
            "GIT_CONFIG_KEY_0": f"url.{source.as_uri()}.insteadOf",
            "GIT_CONFIG_VALUE_0": url,
        })

    def sync(self, success=True):
        return self.shell('''
github_token=fake-test-token
auth_dir="$TEST_ROOT"
sync_checkout "$TEST_ROOT/checkout" https://github.com/HePudding/trekker-camp.git
''', success=success)

    def test_supported_lts_and_architectures_select_matching_docker_source(self):
        for version, codename in (("22.04", "jammy"), ("24.04", "noble"), ("26.04", "resolute")):
            for architecture in ("amd64", "arm64"):
                with self.subTest(version=version, architecture=architecture):
                    (self.root / "os-release").write_text(f'ID=ubuntu\nVERSION_ID="{version}"\n')
                    self.env["TEST_ARCH"] = architecture
                    result = self.shell('''
dpkg() { printf '%s' "$TEST_ARCH"; }
detect_ubuntu "$TEST_ROOT/os-release"
docker_apt_source
''')
                    self.assertIn(f"Suites: {codename}\n", result.stdout)
                    self.assertIn(f"Architectures: {architecture}\n", result.stdout)
                    self.assertIn("Signed-By: /etc/apt/keyrings/docker.asc", result.stdout)

    def test_unsupported_system_fails_before_dependencies(self):
        for distro, version in (("ubuntu", "20.04"), ("ubuntu", "26.10"), ("debian", "13")):
            with self.subTest(distro=distro, version=version):
                (self.root / "os-release").write_text(f"ID={distro}\nVERSION_ID={version}\n")
                self.shell('detect_ubuntu "$TEST_ROOT/os-release"', success=False)

    def test_minimal_ubuntu_installs_timezone_data_for_beijing_timer(self):
        result = self.shell('''
dpkg-query() {
  if [[ $* == *tzdata* ]]; then return 1; fi
  printf 'install ok installed'
}
docker() { :; }
apt-get() { printf 'apt-get %s\n' "$*"; }
install_dependencies
''')
        self.assertIn("apt-get install -y --no-install-recommends tzdata", result.stdout)

    def test_credentials_reach_git_only_and_are_not_saved_in_helper(self):
        result = self.shell('''
github_token=fake-test-token
prepare_auth
printf 'protocol=https\nhost=github.com\n\n' | github_git credential fill
! grep -q fake-test-token "$auth_dir/askpass"
! CAMP_GH_TOKEN="$github_token" "$auth_dir/askpass" "Password for 'https://github.com.evil.invalid':"
! CAMP_GH_TOKEN="$github_token" "$auth_dir/askpass" "Password for 'https://evilgithub.com':"
''')
        self.assertIn("username=x-access-token", result.stdout)
        self.assertIn("password=fake-test-token", result.stdout)

    def test_fast_forward_updates_preserve_origin_and_refuse_local_changes(self):
        source = self.repository("source", {"README": "one"})
        self.redirect(source, CODE_REPO)
        self.sync()
        checkout = self.root / "checkout"
        self.assertEqual(self.git(checkout, "config", "--get", "remote.origin.url"), CODE_REPO)
        (source / "README").write_text("two")
        self.git(source, "commit", "-am", "Update fixture")
        self.sync()
        self.assertEqual((checkout / "README").read_text(), "two")
        (checkout / "README").write_text("local work")
        self.sync(success=False)
        self.assertEqual((checkout / "README").read_text(), "local work")

    def test_wrong_branch_and_unpublished_commits_are_preserved(self):
        source = self.repository("source", {"README": "one"})
        self.redirect(source, CODE_REPO)
        self.sync()
        checkout = self.root / "checkout"
        self.git(checkout, "switch", "-c", "work")
        self.sync(success=False)
        self.assertEqual(self.git(checkout, "branch", "--show-current"), "work")
        self.git(checkout, "switch", "master")
        (checkout / "README").write_text("unpublished work")
        self.git(checkout, "commit", "-am", "Unpublished work")
        self.sync(success=False)
        self.assertEqual((checkout / "README").read_text(), "unpublished work")

    def test_existing_non_repository_directory_is_preserved(self):
        source = self.repository("source", {"README": "one"})
        self.redirect(source, CODE_REPO)
        checkout = self.root / "checkout"
        checkout.mkdir()
        (checkout / "keep").write_text("existing data")
        self.sync(success=False)
        self.assertEqual((checkout / "keep").read_text(), "existing data")

    def test_lfs_downloads_public_content_and_leaves_checkout_clean(self):
        source = self.repository("assets", {".gitattributes": "*.bin filter=lfs diff=lfs merge=lfs -text\n"})
        self.git(source, "lfs", "install", "--local")
        for name in ("public/image.bin", "originals/source.bin"):
            target = source / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(b"fixture-binary-content\0")
        self.git(source, "add", ".")
        self.git(source, "commit", "-m", "Add LFS fixtures")
        self.redirect(source, ASSETS_REPO)
        self.shell('''
github_token=fake-test-token
auth_dir="$TEST_ROOT"
sync_checkout "$TEST_ROOT/checkout" https://github.com/HePudding/trekker-camp-assets.git
git -C "$TEST_ROOT/checkout" lfs install --local --skip-smudge
github_git -C "$TEST_ROOT/checkout" lfs pull --include='public/**' --exclude=
check_checkout "$TEST_ROOT/checkout" https://github.com/HePudding/trekker-camp-assets.git
''')
        self.assertEqual((self.root / "checkout/public/image.bin").read_bytes(), b"fixture-binary-content\0")
        self.assertTrue((self.root / "checkout/originals/source.bin").read_text().startswith("version https://git-lfs"))

    def configuration(self, data_dir=None):
        checkout = self.root / "checkout"
        checkout.mkdir()
        shutil.copy(ROOT / "compose.vps.yml", checkout)
        shutil.copy(ROOT / "compose.assets.yml", checkout)
        self.env["TEST_DATA_DIR"] = str(data_dir) if data_dir else ""
        self.shell('''
camp_dir="$TEST_ROOT/checkout"
resolve_storage "$TEST_DATA_DIR"
site_url=https://camp.example.com
cloudflare_token=$TEST_CF_TOKEN
prepare_cloudflare
chown() { :; }
install() {
  local args=()
  while (($#)); do
    case "$1" in -o|-g) shift 2 ;; *) args+=("$1"); shift ;; esac
  done
  command install "${args[@]}"
}
create_configuration
''')
        return checkout

    def test_configuration_generates_matching_secrets_and_preserves_existing_files(self):
        checkout = self.configuration()
        config = (checkout / ".config/default.yml").read_text()
        database = (checkout / ".config/docker.env").read_text()
        password = database.split("POSTGRES_PASSWORD=", 1)[1].strip()
        self.assertEqual(len(password), 64)
        self.assertIn(f"pass: '{password}'", config)
        self.assertEqual((checkout / ".config/default.yml").stat().st_mode & 0o777, 0o640)
        self.assertEqual((checkout / ".config/docker.env").stat().st_mode & 0o777, 0o600)
        self.assertEqual((checkout / ".config/cloudflare.env").stat().st_mode & 0o777, 0o600)
        self.assertNotIn(CLOUDFLARE_TEST_TOKEN, config)
        self.assertNotIn(CLOUDFLARE_TEST_TOKEN, (checkout / ".config/Caddyfile").read_text())
        result = self.shell('''
camp_dir="$TEST_ROOT/checkout"
site_url=https://changed.example.com
create_configuration
''', success=False)
        self.assertIn("update", result.stderr)
        self.assertEqual((checkout / ".config/default.yml").read_text(), config)

    def test_compose_resolves_runtime_mounts_and_private_ports(self):
        import json

        available = subprocess.run(["bash", "-c", "docker compose version"], capture_output=True)
        if available.returncode != 0:
            self.skipTest("Docker Compose unavailable; Ubuntu CI installs the official plugin")
        self.configuration()
        result = self.shell('''
camp_dir="$TEST_ROOT/checkout"
compose config --format json
''')
        config = json.loads(result.stdout)
        web = config["services"]["web"]
        self.assertEqual(web["command"], ["pnpm", "start"])
        self.assertEqual(web["ports"][0]["host_ip"], "127.0.0.1")
        mount = next(mount for mount in web["volumes"] if mount["target"].endswith("/assets/camp"))
        self.assertEqual(mount["source"], str(self.root / "checkout/private-assets/public"))
        self.assertTrue(mount["read_only"])
        self.assertFalse(mount["bind"]["create_host_path"])
        self.assertNotIn("ports", config["services"]["db"])
        self.assertNotIn("ports", config["services"]["redis"])
        self.assertNotIn("CLOUDFLARE_API_TOKEN", web.get("environment", {}))
        self.assertEqual(config["services"]["caddy"]["environment"]["CLOUDFLARE_API_TOKEN"], CLOUDFLARE_TEST_TOKEN)

    def test_caddy_validates_cloudflare_dns_and_trusted_client_headers(self):
        import json

        image = os.environ.get("CADDY_TEST_IMAGE")
        if not image:
            self.skipTest("CADDY_TEST_IMAGE is supplied by the Caddy image validation job")
        checkout = self.configuration()
        for token in (CLOUDFLARE_TEST_TOKEN, "cfut_" + CLOUDFLARE_TEST_TOKEN, "cfat_" + CLOUDFLARE_TEST_TOKEN):
            with self.subTest(token_format=token[:5]):
                self.env["TEST_CF_TOKEN"] = token
                self.shell('cloudflare_token=$TEST_CF_TOKEN; prepare_cloudflare')
                result = subprocess.run([
                    "docker", "run", "--rm", "-i", "--network=none",
                    "-e", f"CLOUDFLARE_API_TOKEN={token}", image,
                    "caddy", "adapt", "--config", "/dev/stdin", "--adapter", "caddyfile", "--validate",
                ], input=(checkout / ".config/Caddyfile").read_text(), text=True,
                    capture_output=True, timeout=30)
                self.assertEqual(result.returncode, 0, result.stderr)
                config = json.loads(result.stdout)
                server = next(iter(config["apps"]["http"]["servers"].values()))
                self.assertEqual(server["client_ip_headers"], ["CF-Connecting-IP"])
                self.assertTrue(server["trusted_proxies_strict"])
                self.assertIn("173.245.48.0/20", server["trusted_proxies"]["ranges"])
                issuers = config["apps"]["tls"]["automation"]["policies"][0]["issuers"]
                self.assertTrue(any(issuer.get("challenges", {}).get("dns", {}).get("provider", {}).get("name") == "cloudflare" for issuer in issuers))
                self.assertNotIn(token, result.stdout)

    def deployment(self, failure="", data_dir=None):
        checkout = self.configuration(data_dir)
        backup_root = data_dir / "backups" if data_dir else self.root / "checkout.backups"
        backup_root.mkdir()
        self.env["FAILURE"] = failure
        result = self.shell('''
camp_dir="$TEST_ROOT/checkout"
backup_dir=''
compose() {
  printf '%s\n' "$*" >> "$TEST_ROOT/events"
  case "$1:$FAILURE" in build:build|exec:backup) return 42 ;; esac
  if [[ $FAILURE == migration && $* == 'run --rm --no-deps web pnpm migrate' ]]; then return 42; fi
  if [[ $FAILURE == proxy-config && $* == *'caddy validate'* ]]; then return 42; fi
  if [[ $1 == exec ]]; then printf 'PGDMP-test-backup'; fi
  if [[ $FAILURE == health && $* == *--force-recreate* ]]; then return 42; fi
}
curl() {
  printf 'https %s\n' "$*" >> "$TEST_ROOT/events"
  [[ $FAILURE != https ]]
}
git() { printf '%040d\n' 1; }
install_cli() { printf 'install-cli\n' >> "$TEST_ROOT/events"; }
deploy
''', success=not failure)
        return checkout, (self.root / "events").read_text().splitlines(), result

    def test_deployment_orders_build_backup_migration_and_health_checks(self):
        checkout, events, result = self.deployment()
        def index(prefix):
            return next(i for i, event in enumerate(events) if event.startswith(prefix))
        self.assertLess(index("build"), index("stop web"))
        self.assertLess(index("stop web"), index("exec -T db"))
        self.assertLess(index("exec -T db"), index("run --rm --no-deps web pnpm migrate"))
        self.assertLess(index("run --rm --no-deps web"), index("up -d --no-deps --force-recreate --wait"))
        self.assertLess(index("https"), index("install-cli"))
        self.assertIn("camp.example.com:443:127.0.0.1", events[index("https")])
        backup = next((self.root / "checkout.backups").iterdir())
        self.assertEqual((backup / "database.dump").read_text(), "PGDMP-test-backup")
        self.assertEqual((backup / "database.dump").stat().st_mode & 0o777, 0o600)
        with tarfile.open(backup / "config.tar.gz") as archive:
            saved = archive.extractfile(".config/default.yml").read().decode()
            self.assertEqual(saved, (checkout / ".config/default.yml").read_text())
        self.assertIn("部署完成", result.stdout)

    def test_failures_stop_before_later_deployment_steps(self):
        for failure in ("build", "proxy-config", "backup", "migration", "health", "https"):
            with self.subTest(failure=failure):
                # Each attempt needs its own generated configuration and event log.
                for path in (self.root / "checkout", self.root / "checkout.backups"):
                    if path.exists():
                        shutil.rmtree(path)
                (self.root / "events").unlink(missing_ok=True)
                _, events, result = self.deployment(failure)
                self.assertNotIn("部署完成", result.stdout)
                self.assertNotIn("install-cli", events)
                if failure in ("build", "proxy-config"):
                    self.assertNotIn("stop web", events)
                if failure in ("build", "proxy-config", "backup"):
                    self.assertFalse(any(event.startswith("run --rm --no-deps web") for event in events))
                if failure in ("build", "proxy-config", "backup", "migration"):
                    self.assertFalse(any("--force-recreate" in event for event in events))

    def test_help_needs_no_credentials_or_root(self):
        result = self.shell('main --help')
        self.assertIn("Ubuntu 22.04 / 24.04 / 26.04", result.stdout)

    def test_custom_storage_is_persisted_outside_source_and_keeps_secrets_private(self):
        data_dir = self.root / "data disk"
        checkout = self.configuration(data_dir)
        marker = checkout / ".config/data-dir"
        self.assertEqual(marker.read_text(), str(data_dir) + "\n")
        self.assertEqual(marker.stat().st_mode & 0o777, 0o600)
        self.assertFalse((checkout / ".config/default.yml").exists())
        self.assertFalse((checkout / "files").exists())
        self.assertTrue((data_dir / "files").is_dir())
        self.assertEqual((data_dir / ".config/docker.env").stat().st_mode & 0o777, 0o600)
        self.assertTrue((data_dir / "caddy/data").is_dir())
        result = self.shell('printf "%s\\n" "$data_dir" "$config_dir" "$assets_dir" "$backup_root"')
        self.assertEqual(result.stdout.splitlines(), [str(data_dir), str(data_dir / ".config"), str(data_dir / "private-assets"), str(data_dir / "backups")])
        self.shell('resolve_storage "$TEST_ROOT/another-disk"', success=False)
        self.assertEqual(marker.read_text(), str(data_dir) + "\n")

    def test_legacy_layout_keeps_existing_data_and_rejects_silent_relocation(self):
        checkout = self.configuration()
        (checkout / ".config/data-dir").unlink()
        (checkout / "files/keep").write_text("existing-upload")
        result = self.shell('printf "%s\\n" "$data_dir" "$backup_root"')
        self.assertEqual(result.stdout.splitlines(), [str(checkout), str(self.root / "checkout.backups")])
        self.shell('resolve_storage "$TEST_ROOT/another-disk"', success=False)
        self.assertEqual((checkout / "files/keep").read_text(), "existing-upload")
        self.assertFalse((self.root / "another-disk").exists())

    def test_custom_storage_rejects_overlap_with_public_source(self):
        for directory in ("$camp_dir/data", "$TEST_ROOT", "/"):
            with self.subTest(directory=directory):
                self.shell(f'resolve_storage "{directory}"', success=False)

    def test_update_backup_uses_saved_external_configuration(self):
        data_dir = self.root / "data disk"
        self.deployment(data_dir=data_dir)
        backup = next((data_dir / "backups").iterdir())
        with tarfile.open(backup / "config.tar.gz") as archive:
            self.assertEqual(archive.extractfile(".config/default.yml").read(), (data_dir / ".config/default.yml").read_bytes())
        self.assertFalse((self.root / "checkout.backups").exists())

    def test_compose_uses_custom_storage_for_every_persistent_service(self):
        import json

        available = subprocess.run(["bash", "-c", "docker compose version"], capture_output=True)
        if available.returncode != 0:
            self.skipTest("Docker Compose unavailable; Ubuntu CI installs the official plugin")
        data_dir = self.root / "data disk"
        self.configuration(data_dir)
        self.env["CAMP_DATA_DIR"] = "/incorrect-environment-override"
        result = self.shell('compose config --format json')
        config = json.loads(result.stdout)
        for service, target, source in (
            ("web", "/misskey/files", "files"),
            ("web", "/misskey/.config", ".config"),
            ("web", "/misskey/apps/misskey/packages/frontend/assets/camp", "private-assets/public"),
            ("db", "/var/lib/postgresql", "db"),
            ("redis", "/data", "redis"),
            ("caddy", "/data", "caddy/data"),
            ("caddy", "/config", "caddy/config"),
        ):
            with self.subTest(service=service, target=target):
                mount = next(m for m in config["services"][service]["volumes"] if m["target"] == target)
                self.assertEqual(mount["source"], str(data_dir / source))
                self.assertEqual(mount["type"], "bind")
        self.assertEqual(config["services"]["web"]["build"]["context"], str(self.root / "checkout"))

    def cli_repository(self):
        source = self.repository("cli-source", {
            "scripts/deploy.sh": (ROOT / "scripts/deploy.sh").read_text(),
            "scripts/backup.sh": (ROOT / "scripts/backup.sh").read_text(),
        })
        self.redirect(source, CODE_REPO)
        self.env["TEST_CLI_SOURCE"] = str(source)
        self.env["DOWNLOAD_FAILURE"] = ""
        self.env["CLI_REVISION"] = self.git(source, "rev-parse", "HEAD")
        self.shell('install_cli "$TEST_CLI_SOURCE/scripts" "$CLI_REVISION" "$TEST_ROOT/prefix"')
        return source

    def update_cli(self, success=True):
        # Git resolves a real local remote; only the HTTPS file transport is replaced.
        return self.shell('''
curl() {
  local url='' output='' name revision
  while (($#)); do
    case "$1" in
      https://*) url=$1; shift ;;
      -o) output=$2; shift 2 ;;
      *) shift ;;
    esac
  done
  printf '%s\n' "$url" >> "$TEST_ROOT/downloads"
  name=${url##*/}
  [[ $DOWNLOAD_FAILURE != "$name" ]] || return 22
  revision=${url#https://raw.githubusercontent.com/HePudding/trekker-camp/}
  revision=${revision%%/*}
  command git -C "$TEST_CLI_SOURCE" show "$revision:scripts/$name" > "$output"
}
docker() { fail 'CLI self-update must not contact Docker'; }
self_update "$TEST_ROOT/prefix"
''', success=success)

    def test_self_update_installs_matching_bundle_atomically_without_touching_app(self):
        source = self.cli_repository()
        previous = (self.root / "prefix/lib/trekker-camp/current").resolve()
        (source / "scripts/backup.sh").write_text((source / "scripts/backup.sh").read_text() + "\n# New fixture version\n")
        self.git(source, "commit", "-am", "Update CLI fixture")
        revision = self.git(source, "rev-parse", "HEAD")
        self.update_cli()
        current = (self.root / "prefix/lib/trekker-camp/current").resolve()
        self.assertNotEqual(previous, current)
        self.assertTrue(previous.is_dir())
        self.assertEqual((current / "VERSION").read_text(), revision + "\n")
        self.assertEqual((current / "backup.sh").read_bytes(), (source / "scripts/backup.sh").read_bytes())
        self.assertTrue(all(f"/{revision}/scripts/" in url for url in (self.root / "downloads").read_text().splitlines()))
        result = subprocess.run([str(self.root / "prefix/bin/camp"), "version"], env=self.env, text=True, capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(revision, result.stdout)
        self.assertFalse((self.root / "checkout").exists())

    def test_failed_download_and_invalid_bundle_preserve_installed_cli(self):
        source = self.cli_repository()
        previous = (self.root / "prefix/lib/trekker-camp/current").resolve()
        self.env["DOWNLOAD_FAILURE"] = "backup.sh"
        self.update_cli(success=False)
        self.assertEqual((self.root / "prefix/lib/trekker-camp/current").resolve(), previous)
        self.env["DOWNLOAD_FAILURE"] = ""
        for content in ("if; then\n", ""):
            with self.subTest(content=content):
                (source / "scripts/backup.sh").write_text(content)
                self.git(source, "commit", "-am", "Invalid CLI fixture")
                self.update_cli(success=False)
                self.assertEqual((self.root / "prefix/lib/trekker-camp/current").resolve(), previous)
                self.assertEqual((previous / "VERSION").read_text(), self.env["CLI_REVISION"] + "\n")

    @unittest.skipUnless(os.geteuid() == 0, "CLI entry point requires root")
    def test_self_update_dispatch_needs_no_application_or_credentials(self):
        result = self.shell('''
detect_ubuntu() { :; }
flock() { :; }
self_update() { printf 'self-update-dispatched\n'; }
prepare_auth() { fail 'GitHub credentials must not be requested'; }
docker() { fail 'Docker must not be contacted'; }
main self-update
''')
        self.assertIn("self-update-dispatched", result.stdout)


if __name__ == "__main__":
    unittest.main()
