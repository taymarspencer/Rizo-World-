#!/usr/bin/env python3
"""Serve the repository root for the Dungeon Character Lab (development only).

    python3 tools/dungeon-lab/serve.py [port]

then open the printed URL. The lab fetches the hub's own files, so it needs
http (not file://). Nothing is written; the lab keeps all state in memory.
"""
import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = functools.partial(Quiet, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        print(f"Character Lab: http://127.0.0.1:{port}/tools/dungeon-lab/", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
