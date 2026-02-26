import http.server
import socketserver
import os
import json
import base64
import sys
from urllib.parse import urlparse, parse_qs

PORT = 8000
DATA_DIR = os.path.join(os.getcwd(), 'data')

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/api/list':
            self.handle_list()
        elif parsed_path.path.startswith('/api/load'):
            self.handle_load(parsed_path)
        else:
            super().do_GET()

    def do_POST(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/api/save':
            self.handle_save()
        elif parsed_path.path == '/api/save-config':
            self.handle_save_config()
        else:
            self.send_error(404, "Unknown API endpoint")

    def handle_list(self):
        """List all .json drawing files in the data directory, newest first."""
        try:
            files = []
            for f in sorted(os.listdir(DATA_DIR), reverse=True):
                if f.endswith('.json'):
                    filepath = os.path.join(DATA_DIR, f)
                    stat = os.stat(filepath)
                    files.append({
                        'filename': f,
                        'size': stat.st_size,
                        'modified': stat.st_mtime
                    })

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'files': files}).encode('utf-8'))
        except Exception as e:
            print(f"Error listing files: {e}")
            self.send_error(500, str(e))

    def handle_load(self, parsed_path):
        """Return the raw JSON content of a drawing file."""
        try:
            # Path: /api/load?file=drawing-xxx.json
            params = parse_qs(parsed_path.query)
            filename = params.get('file', [None])[0]

            if not filename:
                self.send_error(400, "Missing file parameter")
                return

            # Security: only allow .json files from DATA_DIR
            if not filename.endswith('.json') or '/' in filename or '..' in filename:
                self.send_error(400, "Invalid filename")
                return

            file_path = os.path.join(DATA_DIR, filename)
            if not os.path.exists(file_path):
                self.send_error(404, f"File not found: {filename}")
                return

            with open(file_path, 'rb') as f:
                content = f.read()

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(content)
            print(f"Loaded: {filename}")
        except Exception as e:
            print(f"Error loading file: {e}")
            self.send_error(500, str(e))

    def handle_save_config(self):
        """Overwrite config.default.js with the new config sent as JSON."""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            config = data.get('config')
            if config is None:
                self.send_error(400, 'Missing config')
                return

            # Serialize config to JS module format
            config_json = json.dumps(config, indent=4, ensure_ascii=False)
            js_content = f'export const defaultConfig = {config_json};\n'

            config_path = os.path.join(os.getcwd(), 'src', 'config.default.js')
            with open(config_path, 'w', encoding='utf-8') as f:
                f.write(js_content)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok'}).encode('utf-8'))
            print(f'Config saved to {config_path}')
        except Exception as e:
            print(f'Error saving config: {e}')
            self.send_error(500, str(e))

    def handle_save(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            filename = data.get('filename')
            content_base64 = data.get('content')
            # Support raw JSON content too (for shape data)
            raw_json = data.get('raw_json')

            if not filename:
                self.send_error(400, "Missing filename")
                return

            file_path = os.path.join(DATA_DIR, filename)

            if raw_json is not None:
                # Save raw JSON directly
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(raw_json, f)
            elif content_base64:
                # Save base64-encoded binary (for PDF)
                if ',' in content_base64:
                    _, encoded = content_base64.split(',', 1)
                else:
                    encoded = content_base64
                with open(file_path, 'wb') as f:
                    f.write(base64.b64decode(encoded))
            else:
                self.send_error(400, "Missing content or raw_json")
                return

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "path": file_path}).encode('utf-8'))
            print(f"Saved: {filename}")

        except Exception as e:
            print(f"Error saving file: {e}")
            self.send_error(500, str(e))

    def log_message(self, format, *args):
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
