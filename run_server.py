import http.server
import socketserver
import os
import json
import base64
import sys
from urllib.parse import urlparse

PORT = 8000
DATA_DIR = os.path.join(os.getcwd(), 'data')

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/api/save':
            self.handle_save()
        else:
            self.send_error(404, "Unknown API endpoint")

    def handle_save(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            filename = data.get('filename')
            content_base64 = data.get('content')

            if not filename or not content_base64:
                self.send_error(400, "Missing filename or content")
                return

            if ',' in content_base64:
                _, encoded = content_base64.split(',', 1)
            else:
                encoded = content_base64

            file_path = os.path.join(DATA_DIR, filename)
            with open(file_path, 'wb') as f:
                f.write(base64.b64decode(encoded))

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "path": file_path}).encode('utf-8'))
            print(f"Saved file to {file_path}")

        except Exception as e:
            print(f"Error saving file: {e}")
            self.send_error(500, str(e))

    def log_message(self, format, *args):
        # Suppress routine GET/POST logs to keep terminal clean
        pass

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

print(f"\n  Host-Draw server running at http://localhost:{PORT}")
print(f"  Files saved to: {DATA_DIR}")
print(f"  Press Ctrl+C to stop.\n")

try:
    with ReusableTCPServer(("", PORT), CustomHandler) as httpd:
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\n  Server stopped cleanly.")
    sys.exit(0)
