# SPDX-FileCopyrightText: syuilo and misskey-project
# SPDX-License-Identifier: AGPL-3.0-only

"""Exercise the real Caddy image: CADDY_TEST_IMAGE=camp-caddy-test python3 scripts/maintenance.test.py."""
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, HTTPRedirectHandler
import uuid


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


@unittest.skipUnless(os.environ.get("CADDY_TEST_IMAGE"), "Requires the built Caddy image")
class MaintenanceTests(unittest.TestCase):
    def docker(self, *args):
        return subprocess.run(["docker", *args], check=True, capture_output=True, text=True, timeout=60).stdout.strip()

    def test_outage_upstream_errors_assets_and_recovery(self):
        image = os.environ["CADDY_TEST_IMAGE"]
        name = "camp-maintenance-" + uuid.uuid4().hex[:10]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "proxy").write_text(":8080 {\n import /etc/caddy/camp-site.caddy\n}\n")
            (root / "origin").write_text(":3000 {\n respond /broken502 502\n respond /broken503 503\n respond /broken504 504\n respond /missing 404\n respond \"app fixture\" 200\n}\n")
            (root / "maintenance").mkdir()
            (root / "maintenance/image.webp").write_bytes(b"fixture-art")
            self.docker("network", "create", name)
            try:
                self.docker("run", "-d", "--name", name + "-web", "--network", name, "--network-alias", "web",
                            "-v", f"{root / 'origin'}:/etc/caddy/Caddyfile:ro", image)
                self.docker("run", "-d", "--name", name, "--network", name, "-p", "127.0.0.1::8080",
                            "-v", f"{root / 'proxy'}:/etc/caddy/Caddyfile:ro", "-v", f"{root}:/srv/camp-assets:ro", image)
                address = "http://" + self.docker("port", name, "8080/tcp")

                def request(path="/", accept="text/html", method="GET", expected=200):
                    for attempt in range(40):
                        try:
                            try:
                                response = build_opener(NoRedirect).open(Request(address + path, headers={"Accept": accept}, method=method), timeout=20)
                            except HTTPError as error:
                                response = error
                            body = response.read()
                            response.close()
                            if response.status == expected:
                                return response, body
                        except (URLError, ConnectionError):
                            pass
                        time.sleep(.25)
                    self.fail(f"{method} {path} did not return {expected}")

                response, body = request()
                self.assertEqual(body, b"app fixture")
                self.assertEqual(response.headers["X-Camp-Page"], "app")
                request("/missing", expected=404)
                for status in (502, 503, 504):
                    response, body = request(f"/broken{status}", expected=302)
                    self.assertEqual(response.headers["Location"], f"/__camp-maintenance/v1.html#/broken{status}")
                self.docker("stop", "-t", "1", name + "-web")
                for path, method in (("/", "GET"), ("/notes/example", "GET"), ("/", "HEAD"), ("/api/meta", "POST"), ("/healthz", "GET"), ("/assets/app.js", "GET"), ("/streaming", "GET")):
                    document = path in ("/", "/notes/example")
                    response, body = request(path, method=method, expected=302 if document else 503)
                    self.assertEqual(response.headers["X-Camp-Page"], "maintenance")
                    self.assertIn("no-store", response.headers["Cache-Control"])
                    self.assertEqual(response.headers["CDN-Cache-Control"], "no-store")
                    self.assertEqual(response.headers["Cloudflare-CDN-Cache-Control"], "no-store")
                    self.assertEqual(response.headers["Retry-After"], "60")
                    if path.startswith(("/api/", "/healthz", "/assets/", "/streaming")):
                        self.assertEqual(response.headers["Content-Type"], "application/json")
                        self.assertIn(b"CAMP_MAINTENANCE", body)
                response, body = request("/__camp-maintenance/v1.html")
                self.assertIn("魔王大人，稍作休息吧。".encode(), body)
                self.assertIn("s-maxage=3600", response.headers["Cache-Control"])
                self.assertEqual(response.headers["X-Camp-Page"], "maintenance")
                response, _ = request("/notes/example?q=test", expected=302)
                self.assertEqual(response.headers["Location"], "/__camp-maintenance/v1.html#/notes/example?q=test")
                self.assertEqual(request("/client-assets/camp/maintenance/image.webp")[1], b"fixture-art")
                request("/client-assets/camp/maintenance/absent.webp", expected=404)
                self.docker("start", name + "-web")
                response, body = request()
                self.assertEqual(body, b"app fixture")
                self.assertEqual(response.headers["X-Camp-Page"], "app")
                self.assertIsNone(response.headers.get("Retry-After"))
            finally:
                subprocess.run(["docker", "rm", "-f", name, name + "-web"], capture_output=True)
                self.docker("network", "rm", name)


if __name__ == "__main__":
    unittest.main()
