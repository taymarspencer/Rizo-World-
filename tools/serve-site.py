"""Local static preview with the production 404 document and a real 404 status.
The production host must also preserve this status; see PUBLISHER-READINESS.md.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer
from static_site import StaticSiteHandler
import argparse, functools
parser=argparse.ArgumentParser()
parser.add_argument('--directory', default='dist')
parser.add_argument('--port',type=int,default=8000)
args=parser.parse_args()
directory=Path(args.directory).resolve()
print('Preview: http://127.0.0.1:'+str(args.port),flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),functools.partial(StaticSiteHandler,directory=str(directory))).serve_forever()
