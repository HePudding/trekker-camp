# SPDX-FileCopyrightText: syuilo and misskey-project
# SPDX-License-Identifier: AGPL-3.0-only

"""Run on Linux with: python3 scripts/backup.test.py -v."""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parent.parent
RESTIC_IMAGE = "restic/restic:0.19.1"

COMPOSE = r'''
compose() {
  printf 'compose %s\n' "$*" >> "$TEST_ROOT/events"
  case "$1" in
    ps)
      [[ $FAILURE != status ]] || return 42
      if [[ $RUNNING == yes || ( $RUNNING == restarting && $* == *'--status restarting'* ) ]]; then printf 'web\n'; fi ;;
    stop) [[ $FAILURE != stop ]] || return 42 ;;
    start) [[ $FAILURE != start ]] || return 42 ;;
    exec)
      [[ $FAILURE != database ]] || return 42
      if [[ $FAILURE == signal ]]; then kill -TERM "$BASHPID"; fi
      if [[ $FAILURE != empty ]]; then printf 'PGDMP-test-backup'; fi ;;
  esac
}
git() { printf '0123456789abcdef\n'; }
'''

UPLOAD = r'''
r2_restic() {
  printf 'restic %s\n' "$*" >> "$TEST_ROOT/events"
  [[ $FAILURE != upload ]] || return 3
  # A deletion after the site resumes must not invalidate the captured snapshot.
  if [[ $FAILURE == deleted-upload ]]; then rm "$data_dir/files/upload.bin"; fi
  cp -a "$r2_payload" "$TEST_ROOT/uploaded"
}
'''


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="camp-backup-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.camp = self.root / "camp"
        self.r2 = self.root / "camp.backups/r2"
        for name, content in {
            ".config/default.yml": "url: https://camp.example.com\n",
            ".config/docker.env": "POSTGRES_PASSWORD=test-database-password\n",
            ".config/cloudflare.env": "CLOUDFLARE_API_TOKEN=test-dns-token\n",
            ".config/github-token": "github_pat_test_read_only\n",
            "compose.yml": "services: {}\n",
            "compose.assets.yml": "services: {}\n",
            "files/upload.bin": "immutable-upload-content",
            "private-assets/public/image.png": "runtime-image-content",
            "private-assets/originals/image.psd": "original-art-not-for-backup",
            "private-assets/.git/config": "private-git-metadata",
            "db/PG_VERSION": "18",
        }.items():
            path = self.camp / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
            if name == ".config/github-token":
                path.chmod(0o600)
        self.r2.mkdir(parents=True)
        (self.r2 / "repository.env").write_text("existing-repository-config\n")
        (self.r2 / "password").write_text("existing-encryption-password\n")
        (self.root / "events").touch()
        self.env = {
            **os.environ,
            "DEPLOY_SCRIPT": str(ROOT / "scripts/deploy.sh"),
            "BACKUP_SCRIPT": str(ROOT / "scripts/backup.sh"),
            "TEST_ROOT": str(self.root),
            "FAILURE": "",
            "RUNNING": "yes",
        }
        for name in ("GH_TOKEN", "GITHUB_TOKEN", "CLOUDFLARE_API_TOKEN",
                     "R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID",
                     "R2_SECRET_ACCESS_KEY", "R2_BACKUP_PASSWORD"):
            self.env.pop(name, None)

    def shell(self, body, success=True):
        result = subprocess.run(["bash", "-c", '''
set -Eeuo pipefail
source "$DEPLOY_SCRIPT"
source "$BACKUP_SCRIPT"
camp_dir="$TEST_ROOT/camp"
resolve_storage
r2_dir="$backup_root/r2"
apt-get() { :; }
''' + body], env=self.env, text=True, capture_output=True, timeout=30)
        if success:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        return result

    def events(self):
        return (self.root / "events").read_text().splitlines()

    def test_capture_resumes_site_before_upload_and_excludes_source_secrets(self):
        self.shell(COMPOSE + UPLOAD + "r2_backup")
        events = self.events()
        self.assertLess(events.index("compose stop web"), next(i for i, e in enumerate(events) if e.startswith("compose exec")))
        self.assertLess(events.index("compose start --wait --wait-timeout 180 web"), events.index("restic backup --host trekker-camp --tag daily /backup"))
        uploaded = self.root / "uploaded"
        self.assertEqual({p.name for p in uploaded.iterdir()}, {
            "database.dump", "files", "assets", "config", "compose.yml", "compose.assets.yml", "code-revision",
        })
        self.assertEqual((uploaded / "database.dump").read_text(), "PGDMP-test-backup")
        self.assertEqual((uploaded / "database.dump").stat().st_mode & 0o777, 0o600)
        self.assertEqual(uploaded.stat().st_mode & 0o777, 0o700)
        self.assertEqual((uploaded / "files/upload.bin").read_bytes(), (self.camp / "files/upload.bin").read_bytes())
        self.assertEqual([p.name for p in (uploaded / "assets").iterdir()], ["image.png"])
        self.assertEqual((uploaded / "config/docker.env").read_text(), (self.camp / ".config/docker.env").read_text())
        self.assertEqual((uploaded / "config/github-token").read_text(), "github_pat_test_read_only\n")
        self.assertEqual((uploaded / "config/github-token").stat().st_mode & 0o777, 0o600)
        self.assertEqual(list((self.r2 / "runs").iterdir()), [])
        self.assertTrue((self.r2 / "last-success").is_file())

    def test_upload_deletion_after_resume_preserves_snapshot(self):
        self.env["FAILURE"] = "deleted-upload"
        self.shell(COMPOSE + UPLOAD + "r2_backup")
        self.assertFalse((self.camp / "files/upload.bin").exists())
        self.assertEqual((self.root / "uploaded/files/upload.bin").read_text(), "immutable-upload-content")

    def test_custom_data_location_is_used_by_snapshot_credentials_and_cache(self):
        data_dir = self.root / "data disk"
        data_dir.mkdir()
        for name in (".config", "files", "private-assets", "db"):
            shutil.move(str(self.camp / name), str(data_dir / name))
        (self.camp / ".config").mkdir()
        (self.camp / ".config/data-dir").write_text(str(data_dir) + "\n")
        shutil.move(str(self.root / "camp.backups"), str(data_dir / "backups"))
        self.r2 = data_dir / "backups/r2"
        self.shell(COMPOSE + UPLOAD + "r2_backup")
        self.assertEqual((self.root / "uploaded/files/upload.bin").read_text(), "immutable-upload-content")
        self.assertTrue((self.r2 / "last-success").exists())
        self.assertFalse((self.root / "camp.backups").exists())
        result = self.shell('''
docker() { printf '%s\n' "$@"; }
r2_payload="$TEST_ROOT/uploaded"
r2_restic snapshots
''')
        self.assertIn(f"type=bind,source={data_dir}/restic-cache,target=/cache", result.stdout)
        self.assertIn(str(self.r2 / "repository.env"), result.stdout)

    def test_stopped_site_remains_stopped(self):
        self.env["RUNNING"] = "no"
        self.shell(COMPOSE + UPLOAD + "r2_backup")
        self.assertFalse(any(e.startswith(("compose stop", "compose start")) for e in self.events()))

    def test_restarting_site_is_stopped_for_capture_and_resumed_before_upload(self):
        self.env["RUNNING"] = "restarting"
        self.shell(COMPOSE + UPLOAD + "r2_backup")
        events = self.events()
        self.assertLess(events.index("compose stop web"), next(i for i, event in enumerate(events) if event.startswith("compose exec")))
        self.assertLess(events.index("compose start --wait --wait-timeout 180 web"), events.index("restic backup --host trekker-camp --tag daily /backup"))

    def test_database_failure_and_signal_resume_site_and_preserve_capture(self):
        for failure in ("database", "empty", "signal", "stop"):
            with self.subTest(failure=failure):
                (self.root / "events").write_text("")
                self.env["FAILURE"] = failure
                result = self.shell(COMPOSE + UPLOAD + "r2_backup", success=False)
                self.assertIn("compose start --wait --wait-timeout 180 web", self.events())
                self.assertFalse(any(e.startswith("restic") for e in self.events()))
                self.assertIn("本地副本保留", result.stderr)
                self.assertFalse((self.r2 / "last-success").exists())
        self.assertEqual(len(list((self.r2 / "runs").iterdir())), 4)

    def test_failed_status_does_not_start_or_stop_site(self):
        self.env["FAILURE"] = "status"
        self.shell(COMPOSE + UPLOAD + "r2_backup", success=False)
        self.assertEqual(self.events(), ["compose ps --status running --status restarting --services web"])

    def test_copy_failure_restores_site(self):
        self.shell(COMPOSE + UPLOAD + '''
cp() { return 42; }
r2_backup
''', success=False)
        self.assertIn("compose start --wait --wait-timeout 180 web", self.events())
        self.assertFalse(any(e.startswith("restic") for e in self.events()))

    def test_resume_failure_is_retried_without_upload(self):
        self.env["FAILURE"] = "start"
        self.shell(COMPOSE + UPLOAD + "r2_backup", success=False)
        self.assertEqual(self.events().count("compose start --wait --wait-timeout 180 web"), 2)
        self.assertFalse(any(e.startswith("restic") for e in self.events()))

    def test_upload_failure_retains_local_copy_and_last_success(self):
        self.env["FAILURE"] = "upload"
        (self.r2 / "last-success").write_text("previous-success\n")
        result = self.shell(COMPOSE + UPLOAD + "r2_backup", success=False)
        self.assertEqual(self.events().count("compose start --wait --wait-timeout 180 web"), 1)
        backup = next((self.r2 / "runs").iterdir())
        self.assertEqual((backup / "files/upload.bin").read_text(), "immutable-upload-content")
        self.assertEqual((backup / "database.dump").read_text(), "PGDMP-test-backup")
        self.assertEqual((self.r2 / "last-success").read_text(), "previous-success\n")
        self.assertIn(str(backup), result.stderr)

    def binding(self, code=0, failure=""):
        self.env.update({
            "R2_ENDPOINT": "https://" + "a" * 32 + ".r2.cloudflarestorage.com",
            "R2_BUCKET": "camp-private-backups",
            "R2_ACCESS_KEY_ID": "test-access-id",
            "R2_SECRET_ACCESS_KEY": "test-secret-key",
            "R2_BACKUP_PASSWORD": "test encryption password",
            "VALIDATION_CODE": str(code),
            "FAILURE": failure,
        })
        return self.shell('''
r2_restic() {
  printf 'restic %s\n' "$*" >> "$TEST_ROOT/events"
  [[ $1 != cat ]] || return "$VALIDATION_CODE"
}
r2_backup() {
  printf 'first-backup\n' >> "$TEST_ROOT/events"
  [[ $FAILURE != upload ]]
}
write_backup_units() { printf 'units\n' >> "$TEST_ROOT/events"; }
systemctl() { printf 'systemctl %s\n' "$*" >> "$TEST_ROOT/events"; }
r2_bind
''', success=code in (0, 10) and not failure)

    def test_binding_initializes_only_missing_repo_and_saves_private_credentials(self):
        result = self.binding(code=10)
        self.assertEqual(self.events(), [
            "restic cat config", "restic init", "first-backup", "units",
            "systemctl daemon-reload", "systemctl enable --now trekker-camp-backup.timer",
        ])
        self.assertIn("/camp-private-backups/trekker-camp", (self.r2 / "repository.env").read_text())
        self.assertEqual((self.r2 / "password").read_text(), "test encryption password\n")
        self.assertEqual(self.r2.stat().st_mode & 0o777, 0o700)
        for name in ("repository.env", "password"):
            self.assertEqual((self.r2 / name).stat().st_mode & 0o777, 0o600)
        self.assertFalse(list(self.r2.parent.glob(".r2-bind-*")))
        for secret in ("test-access-id", "test-secret-key", "test encryption password"):
            self.assertNotIn(secret, result.stdout + result.stderr)

    def test_rebinding_existing_repo_reuses_history(self):
        self.binding()
        self.assertNotIn("restic init", self.events())

    def test_first_binding_captures_with_candidate_credentials_before_activation(self):
        for name in ("repository.env", "password"):
            (self.r2 / name).unlink()
        self.env.update({
            "R2_ENDPOINT": "https://" + "a" * 32 + ".r2.cloudflarestorage.com",
            "R2_BUCKET": "camp-private-backups",
            "R2_ACCESS_KEY_ID": "test-access-id",
            "R2_SECRET_ACCESS_KEY": "test-secret-key",
            "R2_BACKUP_PASSWORD": "test encryption password",
        })
        self.shell(COMPOSE + '''
r2_restic() {
  [[ -s $r2_credentials_dir/repository.env && -s $r2_credentials_dir/password ]]
  [[ ! -f $r2_dir/repository.env && ! -f $r2_dir/password ]]
  printf 'restic %s\n' "$*" >> "$TEST_ROOT/events"
  case "$1" in
    cat) return 10 ;;
    backup) cp -a "$r2_payload" "$TEST_ROOT/uploaded" ;;
  esac
}
write_backup_units() { printf 'units\n' >> "$TEST_ROOT/events"; }
systemctl() { printf 'systemctl %s\n' "$*" >> "$TEST_ROOT/events"; }
r2_bind
''')
        self.assertEqual((self.root / "uploaded/database.dump").read_text(), "PGDMP-test-backup")
        self.assertTrue((self.r2 / "repository.env").is_file())
        self.assertTrue((self.r2 / "last-success").is_file())
        events = self.events()
        self.assertLess(events.index("restic backup --host trekker-camp --tag daily /backup"), events.index("units"))

    def test_wrong_password_or_network_error_preserves_existing_binding(self):
        for code in (1, 12):
            with self.subTest(code=code):
                (self.root / "events").write_text("")
                self.binding(code=code)
                self.assertEqual(self.events(), ["restic cat config"])
                self.assertEqual((self.r2 / "repository.env").read_text(), "existing-repository-config\n")
                self.assertEqual((self.r2 / "password").read_text(), "existing-encryption-password\n")
                self.assertFalse(list(self.r2.parent.glob(".r2-bind-*")))

    def test_failed_initial_backup_does_not_enable_timer(self):
        self.binding(failure="upload")
        self.assertEqual(self.events(), ["restic cat config", "first-backup"])
        self.assertEqual((self.r2 / "repository.env").read_text(), "existing-repository-config\n")
        self.assertEqual((self.r2 / "password").read_text(), "existing-encryption-password\n")

    def test_timer_uses_beijing_time_with_catchup_and_bounded_retries(self):
        (self.root / "units").mkdir()
        self.shell('write_backup_units "$TEST_ROOT/units"')
        timer = (self.root / "units/trekker-camp-backup.timer").read_text()
        service = (self.root / "units/trekker-camp-backup.service").read_text()
        self.assertIn("OnCalendar=*-*-* 04:00:00 Asia/Shanghai\n", timer)
        self.assertIn("Persistent=true\n", timer)
        self.assertIn(f'ExecStart=/usr/local/bin/camp backup --dir "{self.camp}"\n', service)
        self.assertIn("Restart=on-failure\n", service)
        self.assertIn("RestartSec=15min\n", service)
        self.assertIn("StartLimitBurst=3\n", service)
        if shutil.which("systemd-analyze"):
            result = subprocess.run([
                "systemd-analyze", "calendar", "--base-time=2026-11-08 19:00:00 UTC",
                "*-*-* 04:00:00 Asia/Shanghai",
            ], env={**os.environ, "TZ": "UTC"}, text=True, capture_output=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("2026-11-08 20:00:00 UTC", result.stdout)

    def test_restic_receives_file_credentials_and_read_only_snapshot(self):
        result = self.shell('''
docker() { printf '%s\n' "$@"; }
r2_payload="$TEST_ROOT/captured"
r2_restic backup --host trekker-camp --tag daily /backup
''')
        args = result.stdout.splitlines()
        self.assertIn(f"{self.r2}/repository.env", args)
        self.assertIn(f"type=bind,source={self.r2}/password,target=/run/secrets/backup-password,readonly", args)
        self.assertIn(f"type=bind,source={self.root}/captured,target=/backup,readonly", args)
        self.assertIn("AWS_DEFAULT_REGION=auto", args)
        self.assertIn(RESTIC_IMAGE, args)
        self.assertNotIn("existing-encryption-password", result.stdout)

    @unittest.skipUnless(os.geteuid() == 0, "CLI entry point requires root")
    def test_main_backup_dispatch_waits_for_deploy_lock_without_github_auth(self):
        (self.camp / "scripts").mkdir()
        shutil.copy(ROOT / "scripts/backup.sh", self.camp / "scripts/backup.sh")
        self.shell(COMPOSE + '''
detect_ubuntu() { :; }
prepare_auth() { fail 'Backup must not require GitHub authentication'; }
flock() { printf 'lock %s\n' "$*" >> "$TEST_ROOT/events"; }
docker() { printf 'docker %s\n' "$1" >> "$TEST_ROOT/events"; }
main backup --dir "$TEST_ROOT/camp"
''')
        events = self.events()
        self.assertEqual(events[:2], ["lock -w 3600 9", "docker info"])
        self.assertIn("docker run", events)
        self.assertTrue((self.r2 / "last-success").exists())

    @unittest.skipUnless(os.environ.get("RESTIC_TEST_IMAGE"), "RESTIC_TEST_IMAGE enables real encryption and restore checks")
    def test_real_restic_encrypted_incremental_backup_and_restore(self):
        result = subprocess.run([
            "docker", "run", "--rm", "--network=none", "--entrypoint", "sh",
            os.environ["RESTIC_TEST_IMAGE"], "-ec", r'''
export RESTIC_REPOSITORY=/repository RESTIC_PASSWORD_FILE=/password
printf 'test-restic-encryption-password\n' > /password
code=0
restic cat config >/dev/null 2>&1 || code=$?
test "$code" = 10
restic init
mkdir -p /backup/files /backup/config
printf 'PGDMP-test-fixture' > /backup/database.dump
printf 'test-upload-content' > /backup/files/image
printf 'database-password-should-stay-encrypted' > /backup/config/settings
restic backup --host trekker-camp --tag daily /backup
restic backup --host trekker-camp --tag daily /backup > /second-backup
grep -q '0 new, *0 changed, *3 unmodified' /second-backup
restic check --read-data
restic restore latest --target /restored
diff -r /backup /restored/backup
! grep -r -q 'database-password-should-stay-encrypted' /repository
printf 'wrong-password\n' > /password
code=0
restic cat config >/dev/null 2>&1 || code=$?
test "$code" = 12
''',
        ], text=True, capture_output=True, timeout=120)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
