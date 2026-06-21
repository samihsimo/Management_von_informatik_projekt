#!/usr/bin/env python3
import json, os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from rase_extractor import extract

class RASEHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        path = urlparse(self.path).path
        if path not in ('/api/extract', '/api/benchmark'):
            self.send_response(404); self.end_headers(); self.wfile.write(b'Not found'); return
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            payload = json.loads(body)
            text = payload.get('text', '')
            mode = payload.get('mode', 'mock')
            if not text.strip():
                raise ValueError('No text provided.')

            if path == '/api/benchmark':
                # Run all three prompt versions and return combined results.
                result = {pv: extract(text, mode, pv) for pv in ('v1', 'v2', 'v3')}
            else:
                prompt_version = payload.get('prompt_version', 'v3')
                result = extract(text, mode, prompt_version)

            response = json.dumps(result, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        except Exception as e:
            response = json.dumps({'error': str(e)}, ensure_ascii=False).encode('utf-8')
            self.send_response(400)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)

    def log_message(self, fmt, *args):
        pass  # suppress request logs

if __name__ == '__main__':
    os.chdir(os.path.dirname(__file__))
    server = ThreadingHTTPServer(('localhost', 8000), RASEHandler)
    print('RASE Task 3 app running at: http://localhost:8000/static/index.html')
    print('Press Ctrl+C to stop.')
    server.serve_forever()
