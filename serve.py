#!/usr/bin/env python3
"""Servidor estático de Wardern SIN caché (para que los cambios aparezcan al refrescar)."""
import http.server
import socketserver
import sys

PORT = 8099
if "--port" in sys.argv:
    PORT = int(sys.argv[sys.argv.index("--port") + 1])


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


class TCPServer(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with TCPServer(("0.0.0.0", PORT), NoCacheHandler) as httpd:
        print(f"Wardern en http://localhost:{PORT} (sin caché)")
        httpd.serve_forever()
