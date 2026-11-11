# SPDX-FileCopyrightText: syuilo and misskey-project
# SPDX-License-Identifier: AGPL-3.0-only

"""Isolated PNVS fixture: signed TLS RPC on 443, test inbox/control on 8080.

Mount a certificate for dypnsapi.aliyuncs.com at /certs/server.crt and its key
at /certs/server.key. Use a Docker network alias for that hostname and trust
the fixture CA with NODE_EXTRA_CA_CERTS in the application under test.
Publish port 8080 on loopback only. Credentials are deliberately fake.
"""

import base64
import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import secrets
import ssl
import threading
import time
from urllib.parse import parse_qs, quote
import uuid


LOCK = threading.Lock()
MESSAGES = []
REQUESTS = []
STATE = {'failNextSend': False}
ACCESS_KEY_ID = 'test-pnvs-id'
ACCESS_KEY_SECRET = 'test-pnvs-secret'


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def respond(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.server.server_port != 8080 or self.path != '/messages':
            return self.respond({}, 404)
        with LOCK:
            self.respond({'messages': MESSAGES, 'requests': REQUESTS})

    def do_POST(self):
        raw = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        if self.server.server_port == 8080:
            if self.path == '/fail-next-send':
                with LOCK:
                    STATE['failNextSend'] = True
                return self.respond({'ok': True})
            return self.respond({}, 404)
        params = {key: values[0] for key, values in parse_qs(raw.decode()).items()}
        signature = params.pop('Signature', '')
        canonical = '&'.join(f'{quote(key, safe="~")}={quote(value, safe="~")}' for key, value in sorted(params.items()))
        signed = 'POST&%2F&' + quote(canonical, safe='~')
        expected = base64.b64encode(hmac.new((ACCESS_KEY_SECRET + '&').encode(), signed.encode(), hashlib.sha1).digest()).decode()
        request_id = str(uuid.uuid4())
        if params.get('AccessKeyId') != ACCESS_KEY_ID or not hmac.compare_digest(signature, expected):
            return self.respond({'Success': False, 'Code': 'SignatureDoesNotMatch', 'RequestId': request_id}, 403)
        if params.get('Version') != '2017-05-25' or params.get('CountryCode') != '86':
            return self.respond({'Success': False, 'Code': 'InvalidParameter', 'RequestId': request_id}, 400)
        action = params.get('Action')
        with LOCK:
            REQUESTS.append({'action': action, 'phone': params.get('PhoneNumber'), 'outId': params.get('OutId'), 'signed': True})
            if action == 'SendSmsVerifyCode':
                if STATE['failNextSend']:
                    STATE['failNextSend'] = False
                    return self.respond({'Success': False, 'Code': 'InternalError', 'RequestId': request_id}, 503)
                template = json.loads(params['TemplateParam'])
                if template.get('code') != '##code##' or params.get('ReturnVerifyCode') != 'false' or params.get('AutoRetry') != '0':
                    return self.respond({'Success': False, 'Code': 'InvalidParameter', 'RequestId': request_id}, 400)
                MESSAGES.append({
                    'phone': params['PhoneNumber'], 'scheme': params['SchemeName'], 'outId': params['OutId'],
                    'template': params['TemplateCode'], 'code': f'{secrets.randbelow(1000000):06}',
                    'expires': time.time() + int(params['ValidTime']),
                })
                return self.respond({'Success': True, 'Code': 'OK', 'RequestId': request_id, 'Model': {'BizId': request_id}})
            if action == 'CheckSmsVerifyCode':
                latest = next((message for message in reversed(MESSAGES) if message['phone'] == params.get('PhoneNumber') and message['scheme'] == params.get('SchemeName')), None)
                passed = latest and latest['expires'] > time.time() and latest['outId'] == params.get('OutId') and latest['code'] == params.get('VerifyCode')
                return self.respond({'Success': True, 'Code': 'OK', 'RequestId': request_id, 'Model': {'VerifyResult': 'PASS' if passed else 'FAIL', 'OutId': params.get('OutId')}})
            return self.respond({'Success': False, 'Code': 'InvalidAction', 'RequestId': request_id}, 400)


if __name__ == '__main__':
    tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    tls.load_cert_chain('/certs/server.crt', '/certs/server.key')
    rpc = ThreadingHTTPServer(('0.0.0.0', 443), Handler)
    rpc.socket = tls.wrap_socket(rpc.socket, server_side=True)
    threading.Thread(target=rpc.serve_forever, daemon=True).start()
    print('Fake PNVS ready: signed HTTPS RPC and isolated test inbox', flush=True)
    ThreadingHTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
