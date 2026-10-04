"""Local fixture for Pages-style HTML routes and the shipped redirect contract.

No application server ships. Cloudflare Pages serves the packaged static files.
Production headers/compression still need verification on the actual preview.
"""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler
from urllib.parse import urlsplit, urlunsplit, unquote


class StaticSiteHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send_head(self):
        url = urlsplit(self.path)
        root = Path(self.directory)
        if url.path in ('/_headers', '/_redirects'):
            self.send_error(404)
            return None
        redirects = root / '_redirects'
        target = None
        status = 308  # Pages' native HTML normalization is permanent.
        if redirects.is_file():
            for line in redirects.read_text().splitlines():
                parts = line.split()
                if not parts or parts[0].startswith('#'):
                    continue
                if len(parts) == 3 and parts[0] == url.path:
                    target = parts[1]
                    status = int(parts[2])
                    break
        if target is None:
            physical = Path(super().translate_path(url.path))
            if url.path.endswith('/index.html') and physical.is_file():
                target = url.path[:-len('index.html')]
            elif url.path.endswith('.html') and physical.is_file():
                target = url.path[:-5]
            elif url.path.endswith('/') and url.path != '/':
                clean = url.path.rstrip('/')
                if Path(super().translate_path(clean + '.html')).is_file():
                    target = clean
        if target is not None:
            destination = urlsplit(target)
            location = urlunsplit((destination.scheme, destination.netloc, destination.path,
                                  destination.query or url.query, destination.fragment))
            self.send_response(status)
            self.send_header('Location', location)
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        return super().send_head()

    def translate_path(self, path):
        physical = Path(super().translate_path(path))
        clean = unquote(urlsplit(path).path)
        if not physical.exists() and not clean.endswith('/') and not physical.suffix:
            html = physical.with_suffix('.html')
            if html.is_file():
                return str(html)
        return str(physical)

    def list_directory(self, path):
        self.send_error(404)
        return None

    def send_error(self, code, message=None, explain=None):
        document = Path(self.directory) / '404.html'
        if code != 404 or not document.is_file():
            return super().send_error(code, message, explain)
        body = document.read_bytes()
        self.send_response(404)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)
