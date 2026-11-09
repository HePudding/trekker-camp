# SPDX-FileCopyrightText: syuilo and misskey-project
# SPDX-License-Identifier: AGPL-3.0-only

"""Run on Linux with: python3 scripts/deploy.test.py -v."""

import errno
import os
from pathlib import Path
import pty
import select
import shutil
import signal
import subprocess
import tarfile
import tempfile
import time
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

    @unittest.skipUnless(os.geteuid() == 0, "CLI entry point requires root")
    def test_lifecycle_commands_use_lock_and_need_no_credentials(self):
        self.configuration()
        for action in ("start", "stop", "restart", "autostart on", "autostart off"):
            with self.subTest(action=action):
                self.env["TEST_ACTION"] = action
                result = self.shell('''
detect_ubuntu() { :; }
flock() { printf 'lock %s\\n' "$*"; }
prepare_auth() { fail 'credentials must not be requested'; }
systemctl() { printf 'systemctl %s\\n' "$*"; }
compose() {
  if [[ $1 == ps ]]; then printf 'web-id\\ndb-id\\nredis-id\\ncaddy-id\\n'
  else printf 'compose %s\\n' "$*"; fi
}
docker() { printf 'docker %s\\n' "$*" >> "$TEST_ROOT/docker-events"; }
curl() { printf 'HTTPS checked\\n'; }
read -ra action <<< "$TEST_ACTION"
main "${action[@]}" --dir "$TEST_ROOT/checkout"
''')
                self.assertIn("lock -n 9", result.stdout)
                if action in ("start", "restart"):
                    self.assertLess(result.stdout.index("lock -n 9"), result.stdout.index("systemctl start docker"))
                    self.assertIn("compose up -d --no-build --pull never --wait --wait-timeout 180", result.stdout)
                    self.assertIn("HTTPS checked", result.stdout)
                if action in ("stop", "restart"):
                    self.assertIn("compose stop --timeout 60", result.stdout)
                if action.startswith("autostart"):
                    self.assertNotIn("compose up", result.stdout)
                    self.assertNotIn("compose stop", result.stdout)
                    self.assertNotIn("systemctl disable", result.stdout)

    @unittest.skipUnless(os.geteuid() == 0, "CLI entry point requires root")
    def test_lifecycle_refuses_changes_during_deploy_or_backup(self):
        self.configuration()
        for action in ("start", "stop", "restart", "autostart off"):
            with self.subTest(action=action):
                self.env["TEST_ACTION"] = action
                result = self.shell('''
detect_ubuntu() { :; }
flock() { return 1; }
systemctl() { touch "$TEST_ROOT/should-not-run"; }
compose() { touch "$TEST_ROOT/should-not-run"; }
read -ra action <<< "$TEST_ACTION"
main "${action[@]}" --dir "$TEST_ROOT/checkout"
''', success=False)
                self.assertIn("另一项营地部署或备份正在运行", result.stderr)
                self.assertFalse((self.root / "should-not-run").exists())

    def test_autostart_persists_in_custom_storage_and_compose_uses_it(self):
        import json

        if subprocess.run(["bash", "-c", "docker compose version"], capture_output=True).returncode:
            self.skipTest("Docker Compose unavailable; Ubuntu CI installs the official plugin")
        data_dir = self.root / "data disk"
        self.configuration(data_dir)
        result = self.shell('''
docker() {
  if [[ $* == *'ps --all --quiet' ]]; then printf 'web-id\\ndb-id\\n'
  elif [[ $1 == update ]]; then printf '%s\\n' "$*" >> "$TEST_ROOT/events"
  else command docker "$@"; fi
}
set_autostart off >&2
compose config --format json
''')
        config = json.loads(result.stdout)
        self.assertEqual({service["restart"] for service in config["services"].values()}, {"no"})
        self.assertTrue((data_dir / ".config/compose.autostart.yml").exists())
        self.assertFalse((self.root / "checkout/.config/compose.autostart.yml").exists())
        self.assertEqual((self.root / "events").read_text().strip(), "update --restart=no web-id db-id")
        self.assertFalse(list((data_dir / ".config").glob(".compose.autostart-*")))

    def test_failed_restart_policy_update_keeps_saved_configuration(self):
        checkout = self.configuration()
        saved = checkout / ".config/compose.autostart.yml"
        previous = saved.read_bytes()
        self.shell('''
compose() { if [[ $1 == ps ]]; then printf 'web-id\\n'; fi; }
docker() { return 42; }
set_autostart off
''', success=False)
        self.assertEqual(saved.read_bytes(), previous)
        self.assertFalse(list(saved.parent.glob(".compose.autostart-*")))

    @unittest.skipUnless(os.environ.get("LIFECYCLE_TEST_IMAGE"), "Set LIFECYCLE_TEST_IMAGE for real Docker lifecycle tests")
    def test_real_lifecycle_and_restart_policies_survive_container_recreation(self):
        import json

        checkout = self.configuration()
        image = os.environ["LIFECYCLE_TEST_IMAGE"]
        self.env["COMPOSE_PROJECT_NAME"] = self.root.name
        (checkout / "compose.yml").write_text(json.dumps({"services": {
            name: {"image": image, "init": True, "command": ["sleep", "3600"],
                   "healthcheck": {"test": ["CMD", "true"], "interval": "1s"}}
            for name in ("web", "db", "redis", "caddy")
        }}))
        (checkout / "compose.assets.yml").write_text("services: {}\n")
        subprocess.run(["docker", "pull", image], env=self.env, check=True, capture_output=True, timeout=120)
        try:
            self.shell('''
systemctl() { :; }
check_https() { site_url=https://camp.example.com; }
start_site
ids=$(compose ps --all --quiet)
set_autostart off
[[ $(compose ps --all --quiet) == "$ids" ]]
[[ $(compose ps --status running --quiet | wc -l) == 4 ]]
compose up -d --force-recreate --no-build --pull never --wait --wait-timeout 15
mapfile -t containers < <(compose ps --all --quiet)
[[ $(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "${containers[@]}" | sort -u) == no ]]
stop_site
[[ -z $(compose ps --status running --quiet) ]]
set_autostart on
[[ -z $(compose ps --status running --quiet) ]]
start_site
mapfile -t containers < <(compose ps --all --quiet)
[[ $(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "${containers[@]}" | sort -u) == always ]]
[[ $(compose ps --status running --quiet | wc -l) == 4 ]]
''')
        finally:
            self.shell('compose down --timeout 2')

    def terminal(self, body, interactions, unprivileged=False):
        """Exercise keyboard input and signals through a real controlling terminal."""
        pid, terminal = pty.fork()
        if pid == 0:
            if unprivileged and os.geteuid() == 0:
                os.setgroups([])
                os.setgid(65534)
                os.setuid(65534)
            os.execvpe("bash", ["bash", "-c", 'source "$SCRIPT"\n' + body], {
                **self.env, "TERM": "xterm-256color", "LC_ALL": "C.UTF-8",
            })
        output = bytearray()
        consumed = 0
        reaped = False

        def read_output(deadline):
            ready, _, _ = select.select([terminal], [], [], max(0, deadline - time.monotonic()))
            self.assertTrue(ready, "Terminal timed out:\n" + output.decode(errors="replace"))
            try:
                chunk = os.read(terminal, 65536)
            except OSError as error:
                if error.errno != errno.EIO:
                    raise
                return False
            output.extend(chunk)
            return bool(chunk)

        try:
            for expected, reply in interactions:
                expected = expected.encode()
                deadline = time.monotonic() + 10
                while (position := output.find(expected, consumed)) < 0:
                    self.assertTrue(read_output(deadline), "Terminal closed:\n" + output.decode(errors="replace"))
                consumed = position + len(expected)
                os.write(terminal, reply.encode())
            deadline = time.monotonic() + 10
            while read_output(deadline):
                pass
            _, status = os.waitpid(pid, 0)
            reaped = True
            return os.waitstatus_to_exitcode(status), output.decode(errors="replace")
        finally:
            if not reaped:
                try:
                    os.killpg(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                os.waitpid(pid, 0)
            os.close(terminal)

    def menu_command(self, body):
        entry = self.root / "camp-command"
        entry.write_text('#!/usr/bin/env bash\nset -Eeuo pipefail\n' + body)
        checkout = self.root / "checkout"
        checkout.mkdir(exist_ok=True)
        (checkout / "compose.yml").touch()
        return 'cli_entry="$TEST_ROOT/camp-command"\n'

    def test_no_command_opens_tui_only_with_a_terminal(self):
        result = self.shell('main')
        self.assertIn("Ubuntu 22.04 / 24.04 / 26.04", result.stdout)
        result = self.shell('main tui', success=False)
        self.assertIn("交互菜单需要终端", result.stderr)
        code, output = self.terminal('main', [("更新和备份会短暂停站。", "q")])
        self.assertEqual(code, 0, output)
        self.assertIn("旅人营地 · VPS 管理", output)
        self.assertIn("\x1b[?25h\x1b[?1049l", output)

    def test_tui_arrows_select_version_and_return_to_custom_directory(self):
        code, output = self.terminal('main --dir "$TEST_ROOT/custom checkout"', [
            ("更新和备份会短暂停站。", "\x1b[A\x1b[A\x1b[A\n"),
            ("camp CLI", ""),
            ("按回车返回菜单。", "\n"),
            ("更新和备份会短暂停站。", "\x1b"),
        ])
        self.assertEqual(code, 0, output)
        self.assertIn(str(self.root / "custom checkout"), output)
        self.assertEqual(output.count("\x1b[?1049h"), 2)
        self.assertEqual(output.count("\x1b[?1049l"), 2)

    def test_tui_updates_selection_in_place_with_windows_ssh_terminal_type(self):
        self.configuration()
        code, output = self.terminal('export TERM=dumb\nmain --dir "$TEST_ROOT/checkout"', [
            ("更新和备份会短暂停站。", "\x1b[B"),
            ("\x1b[6;1H\x1b[2K > \x1b[7m2  查看实时日志", "\x1b[A"),
            ("\x1b[5;1H\x1b[2K > \x1b[7m1  查看站点状态和数据位置", "xq"),
        ])
        self.assertEqual(code, 0, output)
        self.assertEqual(output.count("旅人营地 · VPS 管理"), 1)
        self.assertEqual(output.count("\x1b[2J"), 1)
        self.assertEqual(output.count("\x1b[?1049h"), 1)
        self.assertEqual(output.count("\x1b[?1049l"), 1)
        self.assertIn("\x1b[0m\x1b[?7h\x1b[?25h", output)

    def test_tui_install_wizard_preserves_paths_and_private_environment(self):
        self.env.update(GH_TOKEN="test-github-secret", CLOUDFLARE_API_TOKEN=CLOUDFLARE_TEST_TOKEN,
                        R2_BACKUP_PASSWORD="test-r2-secret")
        command = self.menu_command('''
printf '%s\n' "$@" > "$TEST_ROOT/arguments"
printf '%s\n' "$GH_TOKEN" "$CLOUDFLARE_API_TOKEN" "$R2_BACKUP_PASSWORD" > "$TEST_ROOT/credentials"
''')
        # This fixture exercises dispatch without invoking the system sudo command.
        code, output = self.terminal(command + '''
sudo() { shift 2; "$@"; }
main tui
''', [
            ("更新和备份会短暂停站。", "7"),
            ("代码目录 [/opt/trekker-camp]：", str(self.root / "code disk") + "\n"),
            ("站点地址 [https://camp.stellasora.cafe]：", "camp.example.com\n"),
            ("数据目录 [", ""),
            ("：", str(self.root / "data disk") + "\n"),
            ("按回车返回菜单。", "\n"),
            ("更新和备份会短暂停站。", "0"),
        ])
        self.assertEqual(code, 0, output)
        self.assertEqual((self.root / "arguments").read_text().splitlines(), [
            "install", "--dir", str(self.root / "code disk"), "--url", "https://camp.example.com",
            "--data-dir", str(self.root / "data disk"),
        ])
        secrets = ["test-github-secret", CLOUDFLARE_TEST_TOKEN, "test-r2-secret"]
        self.assertEqual((self.root / "credentials").read_text().splitlines(), secrets)
        for secret in secrets:
            self.assertNotIn(secret, output)

    def test_tui_first_install_accepts_default_configuration_with_enter(self):
        command = self.menu_command('printf "%s\\n" "$@" >> "$TEST_ROOT/arguments"')
        checkout = self.root / "new checkout"
        next_checkout = self.root / "next checkout"
        code, output = self.terminal(command + '''
sudo() { shift 2; "$@"; }
main --dir "$TEST_ROOT/new checkout"
''', [
            ("更新和备份会短暂停站。", "\n"),
            (f"代码目录 [{checkout}]：", "\n"),
            ("站点地址 [https://camp.stellasora.cafe]：", "\n"),
            (f"数据目录 [{checkout}]：", "\n"),
            ("按回车返回菜单。", "\n"),
            ("更新和备份会短暂停站。", "c"),
            (f"代码目录 [{checkout}]：", str(next_checkout) + "\n"),
            ("更新和备份会短暂停站。", "\n"),
            (f"代码目录 [{next_checkout}]：", "\n"),
            ("站点地址 [https://camp.stellasora.cafe]：", "\n"),
            (f"数据目录 [{next_checkout}]：", "\n"),
            ("按回车返回菜单。", "\n"),
            ("更新和备份会短暂停站。", "q"),
        ])
        self.assertEqual(code, 0, output)
        self.assertIn("状态：尚未配置，按回车开始首次安装", output)
        self.assertIn(" > \x1b[7m7  首次安装", output)
        self.assertEqual((self.root / "arguments").read_text().splitlines(), [
            "install", "--dir", str(checkout), "--url", "https://camp.stellasora.cafe",
            "--data-dir", str(checkout),
            "install", "--dir", str(next_checkout), "--url", "https://camp.stellasora.cafe",
            "--data-dir", str(next_checkout),
        ])

    def test_tui_unconfigured_actions_are_disabled_and_wizard_can_be_cancelled(self):
        command = self.menu_command('touch "$TEST_ROOT/should-not-run"')
        code, output = self.terminal(command + 'main --dir "$TEST_ROOT/new checkout"', [
            ("更新和备份会短暂停站。", "123456\n"),
            (f"代码目录 [{self.root / 'new checkout'}]：", ":q\n"),
            ("更新和备份会短暂停站。", "q"),
        ])
        self.assertEqual(code, 0, output)
        self.assertIn("需先安装", output)
        self.assertNotIn("部署配置不存在", output)
        self.assertFalse((self.root / "should-not-run").exists())

    def test_tui_wizard_reprompts_invalid_fields_and_keeps_values_after_failure(self):
        command = self.menu_command('printf "%s\\n" "$@" >> "$TEST_ROOT/arguments"\nexit 42')
        checkout = self.root / "new checkout"
        data = self.root / "data disk"
        code, output = self.terminal(command + '''
sudo() { shift 2; "$@"; }
main --dir "$TEST_ROOT/new checkout"
''', [
            ("更新和备份会短暂停站。", "\n"),
            (f"代码目录 [{checkout}]：", "/\n"),
            (f"代码目录 [{checkout}]：", "\n"),
            ("站点地址 [https://camp.stellasora.cafe]：", "http://camp.example.com\n"),
            ("请输入 HTTPS 站点域名", ""),
            ("站点地址 [https://camp.stellasora.cafe]：", "camp.example.com\n"),
            (f"数据目录 [{checkout}]：", str(checkout / "data") + "\n"),
            ("自定义数据目录需位于代码目录之外", ""),
            (f"数据目录 [{checkout}]：", str(data) + "\n"),
            ("退出码 42", ""),
            ("按回车返回菜单。", "\n"),
            ("更新和备份会短暂停站。", "\n"),
            (f"代码目录 [{checkout}]：", "\n"),
            ("站点地址 [https://camp.example.com]：", "\n"),
            (f"数据目录 [{data}]：", "\n"),
            ("退出码 42", ""),
            ("按回车返回菜单。", "\n"),
            ("更新和备份会短暂停站。", "q"),
        ])
        self.assertEqual(code, 0, output)
        self.assertEqual((self.root / "arguments").read_text().splitlines(), [
            "install", "--dir", str(checkout), "--url", "https://camp.example.com", "--data-dir", str(data),
        ] * 2)

    @unittest.skipUnless(os.geteuid() == 0, "CLI entry point requires root")
    def test_install_requires_credentials_before_changing_system_packages(self):
        result = self.shell('''
detect_ubuntu() { :; }
flock() { :; }
gh() { return 1; }
install_dependencies() { touch "$TEST_ROOT/should-not-run"; }
main install --dir "$TEST_ROOT/new checkout" --url https://camp.stellasora.cafe
''', success=False)
        self.assertIn("GH_TOKEN", result.stderr)
        self.assertFalse((self.root / "should-not-run").exists())

    def test_tui_failed_action_stops_child_and_keeps_menu_usable(self):
        command = self.menu_command('''
false
touch "$TEST_ROOT/should-not-run"
''')
        code, output = self.terminal(command + '''
sudo() { shift 2; "$@"; }
main --dir "$TEST_ROOT/checkout"
''', [
            ("更新和备份会短暂停站。", "3"),
            ("退出码 1", ""),
            ("按回车返回菜单。", "\x1b[A\n"),
            ("更新和备份会短暂停站。", "q"),
        ])
        self.assertEqual(code, 0, output)
        self.assertFalse((self.root / "should-not-run").exists())
        self.assertNotIn("^[[A", output)

    def test_tui_switches_checkout_without_overriding_saved_data_location(self):
        other = self.root / "other checkout"
        other.mkdir()
        (other / "compose.yml").touch()
        command = self.menu_command('printf "%s\\n" "$@" > "$TEST_ROOT/arguments"')
        code, output = self.terminal(command + '''
sudo() { shift 2; "$@"; }
main
''', [
            ("更新和备份会短暂停站。", "c"),
            ("代码目录 [/opt/trekker-camp]：", str(self.root / "other checkout") + "\n"),
            ("更新和备份会短暂停站。", "1"),
            ("按回车返回菜单。", "\n"),
            ("更新和备份会短暂停站。", "q"),
        ])
        self.assertEqual(code, 0, output)
        self.assertEqual((self.root / "arguments").read_text().splitlines(), [
            "status", "--dir", str(self.root / "other checkout"),
        ])

    def test_tui_ctrl_c_stops_logs_and_returns_to_menu(self):
        command = self.menu_command('''
printf 'Log stream ready\n'
sleep 30
''')
        code, output = self.terminal(command + '''
sudo() { shift 2; "$@"; }
main --dir "$TEST_ROOT/checkout"
''', [
            ("更新和备份会短暂停站。", "2"),
            ("Log stream ready", "\x03"),
            ("按回车返回菜单。", "\n"),
            ("更新和备份会短暂停站。", "q"),
        ])
        self.assertEqual(code, 0, output)
        self.assertIn("退出码 130", output)

    def test_tui_dispatches_lifecycle_shortcuts_with_custom_directory(self):
        command = self.menu_command('printf "%s\\n" "$*" >> "$TEST_ROOT/arguments"')
        interactions = []
        for key in ("s", "t", "r", "a", "d"):
            interactions.extend([
                ("更新和备份会短暂停站。", key),
                ("按回车返回菜单。", "\n"),
            ])
        interactions.append(("更新和备份会短暂停站。", "q"))
        code, output = self.terminal(command + '''
sudo() { shift 2; "$@"; }
main --dir "$TEST_ROOT/checkout"
''', interactions)
        self.assertEqual(code, 0, output)
        self.assertEqual((self.root / "arguments").read_text().splitlines(), [
            f"{action} --dir {self.root / 'checkout'}"
            for action in ("start", "stop", "restart", "autostart on", "autostart off")
        ])

    def test_tui_non_root_uses_sudo_for_operations_and_preserves_environment(self):
        self.root.chmod(0o755)
        self.env["GH_TOKEN"] = "test-github-secret"
        self.env["R2_BACKUP_PASSWORD"] = "test-r2-secret"
        command = self.menu_command('printf "Action: %s\\n" "$1"')
        code, output = self.terminal(command + '''
sudo() {
  [[ $1 == --preserve-env=GH_TOKEN,*R2_BACKUP_PASSWORD && $2 == -- ]] || return 1
  [[ $GH_TOKEN == test-github-secret && $R2_BACKUP_PASSWORD == test-r2-secret ]] || return 1
  printf 'Sudo requested\n'
  shift 2
  "$@"
}
main --dir "$TEST_ROOT/checkout"
''', [
            ("更新和备份会短暂停站。", "9"),
            ("Action: version", ""),
            ("按回车返回菜单。", "\n"),
            ("更新和备份会短暂停站。", "4"),
            ("Sudo requested", ""),
            ("Action: backup", ""),
            ("按回车返回菜单。", "\n"),
            ("更新和备份会短暂停站。", "q"),
        ], unprivileged=True)
        self.assertEqual(code, 0, output)
        self.assertEqual(output.count("Sudo requested"), 1)
        self.assertNotIn("test-github-secret", output)
        self.assertNotIn("test-r2-secret", output)

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

    def test_open_tui_uses_new_bundle_after_cli_update(self):
        self.cli_repository()
        self.env["NEXT_REVISION"] = "b" * 40
        # The real bundle installer switches the entry point while the menu stays open.
        code, output = self.terminal('''
source "$TEST_ROOT/prefix/bin/camp"
sudo() { shift 2; "$@"; }
tui_run_original=$(declare -f tui_run)
eval "${tui_run_original/tui_run/tui_run_original}"
tui_run() {
  if [[ $1 == self-update ]]; then
    install_cli "$TEST_CLI_SOURCE/scripts" "$NEXT_REVISION" "$TEST_ROOT/prefix"
  else
    tui_run_original "$@"
  fi
}
main
''', [
            ("更新和备份会短暂停站。", "8"),
            ("按回车返回菜单。", "\n"),
            ("更新和备份会短暂停站。", "9"),
            (self.env["NEXT_REVISION"], ""),
            ("按回车返回菜单。", "\n"),
            ("更新和备份会短暂停站。", "q"),
        ])
        self.assertEqual(code, 0, output)

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
