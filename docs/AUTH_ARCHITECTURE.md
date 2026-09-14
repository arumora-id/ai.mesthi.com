# MESTHI authentication architecture

Production identity is separated from the AI workspace and the business API.

## Domain ownership

- `https://ai.mesthi.com` — React workspace UI only.
- `https://auth.mesthi.com` — login, registration, logout, password/account recovery, MFA/passkeys, identity federation, authorization-code issuance, refresh/session lifecycle.
- `https://api.mesthi.com` — MESTHI control-plane/resource API. It validates trusted access tokens and enforces workspace ownership, roles, plan entitlements, task/runtime rules, and tenant boundaries.

The frontend must never mint JWTs and must never receive provider secrets.

## Recommended production flow

1. An unauthenticated user opens `ai.mesthi.com`.
2. The UI redirects the browser to `auth.mesthi.com/login?return_url=https://ai.mesthi.com/...`.
3. `auth.mesthi.com` authenticates the user and uses OAuth 2.1 / OpenID Connect Authorization Code + PKCE semantics.
4. The callback is handled by a server-side session gateway/BFF in front of `ai.mesthi.com`, not by JavaScript storing tokens.
5. The gateway stores refresh/access credentials server-side and issues an `HttpOnly`, `Secure`, `SameSite=Lax` host session cookie to `ai.mesthi.com`.
6. Browser calls `/api/*` on `ai.mesthi.com`. The gateway validates the browser session and forwards a short-lived Bearer access token to `api.mesthi.com`.
7. `api.mesthi.com` remains the final authorization authority for workspace ownership, role, tenant, entitlement, and runtime checks.
8. Logout revokes the auth session/refresh credential and clears the `ai.mesthi.com` host session.

## Why not a `.mesthi.com` shared cookie

Do not make the primary application session a broad `Domain=.mesthi.com` cookie. A host-only cookie on `ai.mesthi.com` limits exposure if another subdomain is compromised. `auth.mesthi.com` owns identity; the AI gateway owns the AI browser session.

## Frontend contract

Production build:

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=/api
VITE_AUTH_MODE=session
VITE_AUTH_BASE_URL=https://auth.mesthi.com
```

The frontend uses these public routes on the auth service:

- `GET /login?return_url=<absolute-ai-url>`
- `GET /register?return_url=<absolute-ai-url>`
- `GET /logout?return_url=https://ai.mesthi.com/`

`VITE_AUTH_MODE=bearer` exists only as an operator/integration fallback while the session gateway is being commissioned. It is not the public production authentication design.

## Auth service minimum API / protocol surface

The new `auth.mesthi.com` service should expose browser routes for login/register/logout and standards-based OIDC endpoints. Minimum implementation targets:

- authorization endpoint
- token endpoint
- JWKS endpoint
- OIDC discovery document
- session revocation/logout
- password hashing with Argon2id when local credentials are supported
- email verification and password reset
- MFA/passkey extension point
- brute-force/rate limiting and lockout controls
- security/audit events

Prefer asymmetric signing (`RS256` or `ES256`) with key rotation and JWKS for production. `api.mesthi.com` currently validates an HS256 shared secret; migration to issuer + JWKS validation should be completed before exposing public self-service authentication.

## Authorization boundary

Authentication answers **who the user is**. It must not decide whether a task can run.

`api.mesthi.com` continues to enforce:

- user / tenant ownership
- workspace access
- agent access
- subscription status and plan limits
- runtime capacity and task lifecycle
- Git/runtime delivery rules
- provider/model permissions

The auth service may include coarse roles/tenant claims, but API-side database state remains authoritative for business authorization.

## Repository boundary

Recommended repository split:

- `arumora-id/ai.mesthi.com`
- `arumora-id/auth.mesthi.com`
- `arumora-id/api.mesthi.com`

`auth.mesthi.com` should be independently deployable and versioned. Do not embed its source inside the frontend repository.
