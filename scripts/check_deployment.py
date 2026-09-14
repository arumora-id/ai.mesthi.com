"""Validate production configuration without printing credential values. Python >= 3.11."""
import argparse
import base64
import re
import sys
import tomllib
from pathlib import Path
from urllib.parse import urlparse


def validate(env_path, auth_path, redis_path):
    errors = []
    for path in (env_path, auth_path, redis_path):
        if not path.is_file():
            errors.append(f"Missing configuration file: {path}")
    if errors:
        return errors
    env = {}
    for line in env_path.read_text().splitlines():
        if line.strip() and not line.lstrip().startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            env[key.strip()] = value.strip().strip('\"\'')
    for key in ('MESTHI_FRONTEND_IMAGE', 'OAUTH2_PROXY_IMAGE', 'REDIS_IMAGE'):
        if not re.fullmatch(r'[a-zA-Z0-9./:_-]+@sha256:[a-f0-9]{64}', env.get(key, '')):
            errors.append(f'{key} must reference an immutable registry image digest.')
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]*', env.get('MESTHI_EDGE_NETWORK', '')):
        errors.append('MESTHI_EDGE_NETWORK must identify the existing HTTPS proxy network.')
    try:
        auth = tomllib.loads(auth_path.read_text())
    except (ValueError, OSError):
        return errors + ['OAuth2 Proxy configuration is not readable valid TOML.']
    for key in ('oidc_issuer_url', 'client_id', 'client_secret', 'cookie_secret', 'redis_password'):
        if not isinstance(auth.get(key), str) or not auth[key] or 'CHANGE_ME' in auth[key]:
            errors.append(f'Configure {key} in the server-side OAuth2 Proxy secret file.')
    issuer = urlparse(str(auth.get('oidc_issuer_url', '')))
    if issuer.scheme != 'https' or not issuer.hostname or issuer.username or issuer.password:
        errors.append('oidc_issuer_url must be an HTTPS issuer without embedded credentials.')
    expected = {
        'provider': 'oidc', 'redirect_url': 'https://ai.mesthi.com/oauth2/callback',
        'code_challenge_method': 'S256', 'reverse_proxy': True,
        'set_xauthrequest': True, 'pass_access_token': True,
        'cookie_name': '__Host-mesthi_session', 'cookie_secure': True,
        'cookie_httponly': True, 'cookie_samesite': 'lax', 'cookie_path': '/',
        'session_store_type': 'redis', 'redis_connection_url': 'redis://redis:6379/0',
        'request_logging': False,
    }
    for key, value in expected.items():
        if auth.get(key) != value:
            errors.append(f'{key} does not match the supported secure gateway configuration.')
    if auth.get('cookie_domains') or auth.get('insecure_oidc_skip_issuer_verification') or auth.get('ssl_insecure_skip_verify') or auth.get('skip_jwt_bearer_tokens'):
        errors.append('Do not weaken issuer/TLS checks, bypass sessions, or scope the host cookie to other domains.')
    domains = auth.get('email_domains', [])
    if not domains or any('CHANGE_ME' in item for item in domains):
        errors.append('Configure the allowed email domains. Backend workspace membership is still mandatory.')
    try:
        raw = base64.urlsafe_b64decode(str(auth.get('cookie_secret', '')) + '===')
        if len(raw) != 32:
            errors.append('cookie_secret must encode 32 random bytes.')
    except (ValueError, TypeError):
        errors.append('cookie_secret must encode 32 random bytes.')
    redis = redis_path.read_text()
    match = re.search(r'^requirepass\s+(\S+)\s*$', redis, re.M)
    password = str(auth.get('redis_password', ''))
    if len(password) < 32 or not match or match.group(1) != password:
        errors.append('Redis passwords must match and contain at least 32 characters.')
    return errors


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--env-file', type=Path, default=Path('deploy/production.env'))
    parser.add_argument('--auth-file', type=Path, default=Path('deploy/secrets/oauth2-proxy.cfg'))
    parser.add_argument('--redis-file', type=Path, default=Path('deploy/secrets/redis.conf'))
    args = parser.parse_args()
    try:
        errors = validate(args.env_file, args.auth_file, args.redis_file)
    except OSError:
        errors = ['Configuration files could not be read. Check local ownership and permissions.']
    if errors:
        print('\n'.join('- ' + error for error in errors))
        sys.exit(1)
    print('Configuration structure is valid. Verify identity claims, tenant permissions, TLS, and real task delivery in staging before release.')
