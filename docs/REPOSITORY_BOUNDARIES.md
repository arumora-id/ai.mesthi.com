# MESTHI repository boundaries

This document fixes the repository and deployment ownership boundaries before the production platform grows further.

## Required repositories

### `arumora-id/ai.mesthi.com`

**Domain:** `https://ai.mesthi.com`

Owns the browser application only:

- React/Vite workspace UI
- GSAP interaction and motion
- Phaser Live Office visualization
- browser-side API adapters
- user-facing workspace, agent, task, content, billing, and settings UX

It must not own identity-provider code, JWT signing keys, Kubernetes manifests, Terraform credentials, runtime sandbox implementation, or provider secrets.

### `arumora-id/auth.mesthi.com`

**Domain:** `https://auth.mesthi.com`

Owns authentication and identity lifecycle:

- login
- registration
- logout
- email verification
- password reset/recovery
- MFA/passkeys when introduced
- OAuth/OIDC authorization flows
- Authorization Code + PKCE
- token issuance and refresh/revocation
- JWKS/public signing keys
- user identity and authentication-session persistence

This service is the identity authority. It must not become the business authorization authority for workspaces, billing, tasks, runtime execution, or Git access.

### `arumora-id/api.mesthi.com`

**Domain:** `https://api.mesthi.com`

Owns the public control plane and business authorization:

- authenticated user context
- tenant/workspace ownership
- agents
- tasks and task lifecycle
- billing plans, subscriptions, credits, and entitlements
- runtime orchestration contracts
- permission checks before execution

The API should migrate from a shared HS256 JWT secret to asymmetric validation (RS256 or ES256) using issuer metadata and JWKS published by `auth.mesthi.com` before public self-service authentication is enabled.

### `arumora-id/mesthi-infra`

**Deployment ownership:** MESTHI platform infrastructure.

Owns infrastructure-as-code and environment deployment composition:

- k3s/Kubernetes namespaces
- Helm charts or Kustomize overlays
- ingress/reverse-proxy configuration
- DNS declaration/documentation
- TLS/ACME configuration
- deployments/services for `ai`, `auth`, `api`, router, workers, and supporting services
- PostgreSQL/Redis/object-storage connection wiring
- NetworkPolicy
- resource requests/limits
- PodDisruptionBudget where required
- observability configuration
- secret *references* and secret-management integration
- staging/production overlays

Raw production secrets must never be committed to this repository. Use Kubernetes Secrets populated by an external secret mechanism or deployment-time secret injection.

## Future runtime repositories

Runtime components should remain separate when their lifecycle or security boundary differs from the public API. Candidate boundaries include:

- `mesthi-runtime` / Sandbox Manager
- `mesthi-git-broker`
- `mesthi-git-finalizer`
- `mesthi-worker`

Do not create these repositories solely for naming consistency. Split them when they become independently deployable or require a distinct security/availability boundary.

## Recommended request path

```text
Browser
  |
  +--> ai.mesthi.com
  |      React/Vite workspace
  |
  +--> auth.mesthi.com
  |      OIDC identity service
  |      Authorization Code + PKCE
  |
  +--> /api (same-origin BFF/gateway from ai.mesthi.com)
         |
         +--> api.mesthi.com
                |
                +--> database / billing
                +--> runtime control plane
                +--> OmniRoute / Hermes through server-side boundaries
```

The browser should prefer a host-only `Secure`, `HttpOnly`, `SameSite=Lax` session cookie on the application/BFF boundary. Provider credentials and long-lived tokens must not be exposed to browser JavaScript.

## Creation order

1. Create `auth.mesthi.com` as a private repository.
2. Create `mesthi-infra` as a private repository.
3. Bootstrap `auth.mesthi.com` with OIDC/JWKS/session contracts before wiring production login pages.
4. Bootstrap `mesthi-infra` with environment structure, ingress, and service contracts before introducing additional production dependencies.
5. Update `api.mesthi.com` to validate asymmetric tokens issued by `auth.mesthi.com`.
6. Complete the `ai.mesthi.com` login/register/logout UX against the real auth service and BFF/session gateway.

## Environment ownership

Suggested infrastructure layout:

```text
mesthi-infra/
  apps/
    ai/
    auth/
    api/
    omniroute/
  platform/
    ingress/
    observability/
    storage/
    database/
    secrets/
  environments/
    staging/
    production/
```

Application repositories build versioned container artifacts. `mesthi-infra` selects which immutable image version is deployed to each environment. Application repositories should not directly mutate production cluster state.

## Decision

`auth.mesthi.com` and `mesthi-infra` are foundational repositories and should be created before further production integration. This prevents identity and deployment concerns from leaking into the frontend or control-plane repositories and gives later runtime components stable contracts to integrate against.
