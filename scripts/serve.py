#!/usr/bin/env python3
"""Local preview server with caching disabled, so edits show up on plain reload.

Usage:  python3 scripts/serve.py            (serves on http://localhost:8843)
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8843
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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


if __name__ == "__main__":
    print(f"Serving {ROOT} at http://localhost:{PORT}/index.html  (Ctrl+C to stop)")
    ThreadingHTTPServer(("", PORT), NoCacheHandler).serve_forever()
