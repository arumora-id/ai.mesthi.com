"""Read-only staging/production API checks. Never logs tokens, payloads, or tenant names."""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from urllib.parse import urlparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='https://api.mesthi.com')
    parser.add_argument('--workspace', required=True)
    args = parser.parse_args()
    base = args.base.rstrip('/')
    url = urlparse(base)
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment:
        raise ValueError('Use an HTTPS API URL without embedded credentials, query, or fragment.')
    workspace_id = str(uuid.UUID(args.workspace))
    token = os.environ.get('MESTHI_SMOKE_TOKEN', '')
    if not token:
        raise ValueError('Provide a short-lived authorized token via MESTHI_SMOKE_TOKEN.')
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    opener = urllib.request.build_opener(NoRedirect)
    for path in ('/v1/me', '/v1/workspaces', f'/v1/workspaces/{workspace_id}/agents', f'/v1/workspaces/{workspace_id}/tasks', f'/v1/workspaces/{workspace_id}/entitlements'):
        request = urllib.request.Request(base + path, headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/json'}, method='GET')
        try:
            with opener.open(request, timeout=15) as response:
                if 'application/json' not in response.headers.get('Content-Type', ''):
                    raise ValueError('Expected JSON from the API.')
                data = json.load(response)
                if path.endswith(('/agents', '/tasks')):
                    if not isinstance(data, list) or any(row.get('workspace_id') != workspace_id for row in data):
                        raise ValueError('Workspace scope check failed.')
                if path.endswith('/entitlements') and data.get('workspace_id') != workspace_id:
                    raise ValueError('Entitlement workspace scope check failed.')
            print('PASS ' + path.replace(workspace_id, '{workspace_id}'))
        except urllib.error.HTTPError as error:
            print('FAIL HTTP ' + str(error.code) + ' for ' + path.replace(workspace_id, '{workspace_id}'))
            return 1
    print('Read-only API checks passed. Login through the frontend and actual task delivery still require a staging acceptance run.')
    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, urllib.error.URLError, TimeoutError):
        print('API check failed. Verify URL, TLS, token, workspace access, and network connectivity. No response body was logged.')
        sys.exit(1)
