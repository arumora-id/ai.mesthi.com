# Frontend–C4 API contract

Canonical source: [api.mesthi.com commit 09fcaccc](https://github.com/arumora-id/api.mesthi.com/blob/09fcaccc449d09456026de90dc2665ddcb5e32ce/openapi/openapi.json), OpenAPI 3.1.0 / API 1.12.1. The exact snapshot is included as [openapi.c4.json](openapi.c4.json). The API repository currently contains documentation, not runtime implementation.

## Implemented requests

| Method        | Path                                                 | Use                                                                          |
| ------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| GET           | /v1/me                                               | Verify authenticated access; no client-side role inference                   |
| GET           | /v1/models                                           | Model suggestions only when a recognized `data: [{id}]` envelope is returned |
| GET, POST     | /v1/workspaces                                       | List authorized workspaces; create                                           |
| PATCH, DELETE | /v1/workspaces/{workspace_id}                        | Edit or delete                                                               |
| GET, POST     | /v1/workspaces/{workspace_id}/agents                 | List or create agents                                                        |
| PATCH, DELETE | /v1/workspaces/{workspace_id}/agents/{agent_id}      | Edit or delete agents                                                        |
| GET, POST     | /v1/workspaces/{workspace_id}/tasks                  | List or create tasks                                                         |
| PATCH, DELETE | /v1/workspaces/{workspace_id}/tasks/{task_id}        | Edit drafts or delete eligible records; backend decides eligibility          |
| POST          | /v1/workspaces/{workspace_id}/tasks/{task_id}/queue  | Queue explicitly                                                             |
| POST          | /v1/workspaces/{workspace_id}/tasks/{task_id}/start  | Start actual execution after user confirmation                               |
| POST          | /v1/workspaces/{workspace_id}/tasks/{task_id}/cancel | Request cancellation                                                         |
| GET           | /v1/workspaces/{workspace_id}/entitlements           | Actual plan, subscription status, limits, and available credits              |
| GET           | /v1/billing/plans                                    | Actual plan catalog and prices; no checkout operation                        |

Responses for workspace, agent, task, entitlements, and plans are validated with Zod. Identifiers are UUIDs. Every agent, task, and entitlement response must match the selected workspace. UI validation is supplementary; backend authorization remains mandatory.

Only the active workspace is loaded. The frontend polls every 15 seconds while visible and refreshes on visibility/network restoration. In-flight reads are aborted when replaced; stale responses and responses arriving after logout cannot restore private data.

## Commands and errors

POST/PATCH/DELETE are never retried automatically, including in nginx. A timeout, network loss, malformed success response, or server failure can leave a command's outcome unknown. The interface blocks new commands until the user explicitly refreshes and reviews server state. This does not provide server-side exactly-once execution: idempotency keys and optimistic concurrency require additional API support.

HTTP 401/403 during workspace loading clears private state. Service failures preserve only a clearly marked, read-only stale view. Known status aliases are mapped explicitly; unknown values are not interpreted as successful completion.

`TaskRead` has no progress percentage, TaskSession ID, commit SHA, remote SHA, or delivery evidence. None is fabricated. A task's `result_summary` is plain text returned by the backend, not an object-storage artifact. No arbitrary HTML is rendered.

Create Task does not queue or start it. Agent system prompts are context, not authorization. BYOK selection assumes the provider credentials were already provisioned server-side; no credential-registration endpoint is invented.

## Authentication contract

The included gateway implements same-origin cookie authentication using OAuth2 Proxy + Redis and forwards the authenticated user's access token as `Authorization: Bearer …` to C4. The frontend uses `credentials: same-origin`, `cache: no-store`, and rejects HTTP redirects on API requests.

The deployed API must accept and verify the selected OIDC provider's access token, including the expected audience and tenant/role mapping. Its OpenAPI only declares HTTP Bearer and does not establish these identity details. If C4 currently accepts a different token format, a verified server-side token exchange or identity integration must be implemented before this gateway can be used. Never replace that integration with a global admin token.

The gateway accepts only the implemented API paths. The existing /v1/sessions API and reconcile endpoint are not mapped to tasks without a verified TaskSession reference. Generic artifacts, skills, schedules, approvals, OAuth/MCP management, media jobs, and payments are outside the current contract.
