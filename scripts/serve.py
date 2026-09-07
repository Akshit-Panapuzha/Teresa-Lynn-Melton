#!/usr/bin/env python3
"""Local preview server with caching disabled, so edits show up on plain reload.

Also fakes the /api/comments endpoint with an in-memory list so the comment
box can be tried locally. Nothing is saved — on the live site (Vercel) the
real api/comments.js commits comments to comments.json in the GitHub repo.

Usage:  python3 scripts/serve.py            (serves on http://localhost:8843)
"""
import json
import os
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8843
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAKE_COMMENTS = []


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass

    def _json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/comments":
            photo = parse_qs(url.query).get("photo", [None])[0]
            result = [c for c in FAKE_COMMENTS if not photo or c["photo"] == photo]
            return self._json(200, {"comments": result})
        return super().do_GET()

    def do_POST(self):
        url = urlparse(self.path)
        if url.path != "/api/comments":
            return self._json(404, {"error": "Not found"})
        length = int(self.headers.get("Content-Length", 0))
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._json(400, {"error": "Invalid request body."})
        if data.get("website"):
            return self._json(200, {"ok": True})
        name = str(data.get("name", "")).strip()[:60]
        message = str(data.get("message", "")).strip()[:1000]
        photo = str(data.get("photo", "")).strip()
        if not photo or ".." in photo:
            return self._json(400, {"error": "Unknown photo."})
        if not name:
            return self._json(400, {"error": "Please add your name."})
        if len(message) < 2:
            return self._json(400, {"error": "Please write a message."})
        comment = {
            "id": f"local-{int(time.time() * 1000)}",
            "photo": photo,
            "name": name,
            "message": message,
            "date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        FAKE_COMMENTS.append(comment)
        return self._json(201, {"ok": True, "comment": comment})


if __name__ == "__main__":
    print(f"Serving {ROOT} at http://localhost:{PORT}/index.html  (Ctrl+C to stop)")
    print("Comments posted here are kept in memory only (local preview).")
    ThreadingHTTPServer(("", PORT), NoCacheHandler).serve_forever()
