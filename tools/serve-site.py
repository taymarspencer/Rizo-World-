"""Local static preview with the production 404 document and a real 404 status.
The production host must also preserve this status; see PUBLISHER-READINESS.md.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import argparse, functools
parser=argparse.ArgumentParser()
parser.add_argument('--directory', default='dist')
parser.add_argument('--port',type=int,default=8000)
args=parser.parse_args()
directory=Path(args.directory).resolve()
class Handler(SimpleHTTPRequestHandler):
    def send_error(self, code, message=None, explain=None):
        document=directory/'404.html'
        if code!=404 or not document.is_file(): return super().send_error(code,message,explain)
        body=document.read_bytes()
        self.send_response(404); self.send_header('Content-Type','text/html; charset=utf-8')
        self.send_header('Content-Length',str(len(body))); self.end_headers()
        if self.command!='HEAD': self.wfile.write(body)
print('Preview: http://127.0.0.1:'+str(args.port),flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),functools.partial(Handler,directory=str(directory))).serve_forever()
