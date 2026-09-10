#!/usr/bin/env python3
"""Persistent loopback-only production preview with GitHub Pages basename/SPA routes."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote
ROOT = Path(__file__).resolve().parents[1] / 'dist'
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if path.startswith('/13f-tracker/'):
            path = path[len('/13f-tracker'):]
        self.path = path
        if not Path(path).suffix:
            self.path = '/index.html'
        super().do_GET()
if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 8890), Handler).serve_forever()
