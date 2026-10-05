#!/usr/bin/env python3
"""Static server with HTTP range requests so the flight video can scrub."""

import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        path = self.translate_path(self.path.split("?", 1)[0])
        range_header = self.headers.get("Range")
        if not range_header or not os.path.isfile(path):
            return super().do_GET()

        size = os.path.getsize(path)
        try:
            units, _, span = range_header.partition("=")
            start_s, _, end_s = span.partition("-")
            if units.strip() != "bytes":
                raise ValueError
            start = int(start_s) if start_s else 0
            end = int(end_s) if end_s else size - 1
        except ValueError:
            self.send_error(416, "Invalid range")
            return

        end = min(end, size - 1)
        if start > end or start < 0:
            self.send_error(416, "Invalid range")
            return

        length = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(length))
        self.end_headers()
        with open(path, "rb") as handle:
            handle.seek(start)
            remaining = length
            while remaining:
                chunk = handle.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
