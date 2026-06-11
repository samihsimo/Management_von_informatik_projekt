#!/usr/bin/env python3
import json, os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from rase_extractor import extract
class RASEHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if urlparse(self.path).path!='/api/extract':
            self.send_response(404); self.end_headers(); self.wfile.write(b'Not found'); return
        try:
            length=int(self.headers.get('Content-Length',0)); body=self.rfile.read(length).decode('utf-8')
            payload=json.loads(body); text=payload.get('text',''); mode=payload.get('mode','mock')
            if not text.strip(): raise ValueError('No text provided.')
            response=json.dumps(extract(text,mode),ensure_ascii=False).encode('utf-8')
            self.send_response(200); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(response))); self.end_headers(); self.wfile.write(response)
        except Exception as e:
            response=json.dumps({'error':str(e)},ensure_ascii=False).encode('utf-8')
            self.send_response(400); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(response))); self.end_headers(); self.wfile.write(response)
if __name__=='__main__':
    os.chdir(os.path.dirname(__file__)); server=ThreadingHTTPServer(('localhost',8000), RASEHandler)
    print('RASE Task 3 app running at: http://localhost:8000/static/index.html'); print('Press Ctrl+C to stop.'); server.serve_forever()
