"""Exercise the actual nginx configuration against isolated test-only upstreams."""
import http.client
import json
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
received = []

class Auth(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/oauth2/auth':
            ok = self.headers.get('Cookie') == 'session=test'
            self.send_response(202 if ok else 401)
            if ok:
                self.send_header('X-Auth-Request-Access-Token', 'server-test-token')
                self.send_header('Set-Cookie', '__Host-mesthi_session=refreshed; Path=/; HttpOnly; Secure; SameSite=Lax')
            self.end_headers()
        else:
            self.send_response(200)
            self.send_header('X-Access-Token', 'must-not-leak')
            self.end_headers()
    def log_message(self, *args):
        pass

class Backend(BaseHTTPRequestHandler):
    def handle_request(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', '0')))
        received.append({'method': self.command, 'path': self.path, 'headers': dict(self.headers), 'body': body})
        self.send_response(200 if self.headers.get('Authorization') == 'Bearer server-test-token' else 401)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Authorization', 'must-not-leak')
        self.send_header('Set-Cookie', 'upstream-cookie=must-not-leak')
        self.end_headers()
        self.wfile.write(json.dumps({'ok': True}).encode())
    do_GET = do_POST = do_PATCH = do_DELETE = handle_request
    def log_message(self, *args):
        pass

@unittest.skipUnless(shutil.which('nginx'), 'nginx is installed by the CI gateway job')
class GatewayTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.auth = ThreadingHTTPServer(('127.0.0.1', 0), Auth)
        cls.backend = ThreadingHTTPServer(('127.0.0.1', 0), Backend)
        for server in (cls.auth, cls.backend):
            threading.Thread(target=server.serve_forever, daemon=True).start()
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            cls.port = sock.getsockname()[1]
        config = (ROOT / 'deploy/nginx.conf').read_text()
        config = config.replace('listen 8080;', f'listen 127.0.0.1:{cls.port};')
        config = config.replace('auth:4180', f'127.0.0.1:{cls.auth.server_port}')
        # Test transport stays on loopback; production TLS settings remain asserted separately.
        config = config.replace('https://api.mesthi.com/', f'http://127.0.0.1:{cls.backend.server_port}/')
        config = config.replace('/etc/nginx/mesthi/security-headers.conf', str(ROOT / 'deploy/security-headers.conf'))
        config = config.replace('/usr/share/nginx/html', str(ROOT / 'dist'))
        config = config.replace('/tmp/nginx.pid', cls.temp.name + '/nginx.pid')
        for name in ('client_temp', 'proxy_temp', 'fastcgi_temp', 'uwsgi_temp', 'scgi_temp'):
            config = config.replace('/tmp/' + name, cls.temp.name + '/' + name)
        config = config.replace('/dev/stdout', cls.temp.name + '/access.log').replace('/dev/stderr', cls.temp.name + '/error.log')
        path = Path(cls.temp.name) / 'nginx.conf'
        path.write_text(config)
        check = subprocess.run(['nginx', '-t', '-c', str(path)], capture_output=True, text=True)
        if check.returncode:
            raise RuntimeError(check.stderr)
        cls.proc = subprocess.Popen(['nginx', '-c', str(path), '-g', 'daemon off;'])
        for _ in range(50):
            try:
                connection = http.client.HTTPConnection('127.0.0.1', cls.port, timeout=1)
                connection.request('GET', '/healthz')
                if connection.getresponse().status == 200:
                    connection.close()
                    break
            except OSError:
                time.sleep(0.05)
        else:
            raise RuntimeError('nginx did not become ready')
    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(timeout=5)
        for server in (cls.auth, cls.backend):
            server.shutdown()
            server.server_close()
        cls.temp.cleanup()
    def setUp(self):
        received.clear()
    def request(self, method='GET', path='/api/v1/workspaces', headers=None, body=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=3)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return result
    def test_unauthenticated_bearer_cannot_bypass_session(self):
        status, _, _ = self.request(headers={'Authorization': 'Bearer attacker'})
        self.assertEqual(status, 401)
        self.assertEqual(received, [])
    def test_gateway_injects_token_without_exposing_it(self):
        status, headers, _ = self.request(headers={'Cookie': 'session=test', 'Authorization': 'Bearer attacker', 'X-User': 'admin'})
        self.assertEqual(status, 200)
        self.assertEqual(received[0]['headers'].get('Authorization'), 'Bearer server-test-token')
        self.assertNotIn('Cookie', received[0]['headers'])
        self.assertNotIn('X-User', received[0]['headers'])
        self.assertNotIn('Authorization', headers)
        self.assertIn('__Host-mesthi_session=refreshed', headers.get('Set-Cookie', ''))
        self.assertNotIn('upstream-cookie', headers.get('Set-Cookie', ''))
        self.assertIn('no-store', headers.get('Cache-Control', ''))
        self.assertIn("frame-ancestors 'none'", headers.get('Content-Security-Policy', ''))
    def test_same_origin_write_reaches_backend_once(self):
        status, _, _ = self.request('POST', headers={'Cookie': 'session=test', 'Origin': 'https://ai.mesthi.com', 'X-Mesthi-Request': '1', 'Content-Type': 'application/json'}, body='{"name":"A"}')
        self.assertEqual(status, 200)
        self.assertEqual(len(received), 1)
        self.assertEqual(received[0]['body'], b'{"name":"A"}')
        self.assertEqual(received[0]['path'], '/v1/workspaces')
    def test_cross_origin_and_missing_origin_writes_are_blocked(self):
        for origin in ('https://other.example', 'https://sub.ai.mesthi.com', 'null', ''):
            status, _, _ = self.request('POST', headers={'Cookie': 'session=test', 'Origin': origin, 'X-Mesthi-Request': '1'})
            self.assertEqual(status, 403)
        self.assertEqual(received, [])
    def test_writes_require_custom_header(self):
        status, _, _ = self.request('DELETE', headers={'Cookie': 'session=test', 'Origin': 'https://ai.mesthi.com'})
        self.assertEqual(status, 403)
        self.assertEqual(received, [])
    def test_internal_routes_and_unimplemented_extensions_are_not_proxied(self):
        for path in ('/api/health', '/api/docs', '/api/internal/admin', '/api/v1/knowledge', '/_auth', '/oauth2/userinfo'):
            status, _, _ = self.request(path=path, headers={'Cookie': 'session=test'})
            self.assertEqual(status, 404, path)
        self.assertEqual(received, [])
    def test_frontend_and_missing_assets_have_safe_responses(self):
        status, headers, _ = self.request(path='/')
        self.assertEqual(status, 200)
        self.assertIn('no-store', headers.get('Cache-Control', ''))
        status, _, _ = self.request(path='/assets/not-found.js')
        self.assertEqual(status, 404)

class ProductionTransportTests(unittest.TestCase):
    def test_tls_and_no_replay_are_required_in_shipped_config(self):
        config = (ROOT / 'deploy/nginx.conf').read_text()
        self.assertIn('proxy_ssl_verify on;', config)
        self.assertIn('proxy_ssl_server_name on;', config)
        self.assertIn('proxy_next_upstream off;', config)
        self.assertNotIn('proxy_ssl_verify off;', config)
        self.assertIn('proxy_pass https://api.mesthi.com/;', config)

if __name__ == '__main__':
    unittest.main()
