# MESTHI · AI workspace

React + Vite + TypeScript + Windi CSS, with GSAP interface animation and a Phaser Live Office. All business operations use the Mesthi control-plane API. The application contains no demo engine, seeded workspace, simulated execution, local credit ledger, or local business-data persistence.

This release prepares the frontend and authentication gateway for production configuration. It is **not an end-to-end production certification**: real identity-provider compatibility, tenant isolation, infrastructure, and task delivery must pass the staging acceptance checks in [Production readiness](docs/PRODUCTION_READINESS.md).

## Run and verify

Use Node.js 24 and Python 3.11+ for deployment checks.

```sh
npm ci
npm run dev
```

An authenticated same-origin gateway at `/api` is required. Without it, the application shows an authentication or connection error. Vite development and preview servers are not production authentication gateways.

```sh
npm run format:check
npm run build
npm run verify:bundle
npm test
npx playwright install --with-deps chromium
npm run test:e2e
python3 -m unittest discover -s tests -p 'test_*.py'
```

Browser and unit tests use isolated fixtures under `tests/`. Fixtures are never imported by the application or included in the production bundle. Gateway tests need nginx, installed by CI. Test fixtures are not evidence of successful execution against the deployed backend.

## Real operations

- Authenticated workspace listing, creation, editing, and deletion.
- Agent creation, editing, disabling, deletion, model source/ID, system instructions, and optional repository configuration.
- Task creation, editing, deletion, explicit queue/start/cancel, server status and error details.
- Content briefs submitted as ordinary tasks to a configured agent.
- Task result summaries returned by the backend, displayed as text and downloadable as Markdown.
- Subscription, credit balance, plan limits, and plan prices from the API.
- Live Office derived from agent/task state, search, responsive layout, light/dark appearance, and reduced-motion support.
- Session expiry clears private data; workspace changes clear the previous view immediately; uncertain mutation responses block further changes until explicit refresh and review.

File uploads, persistent custom sprites, skills, atomic workforce packs, workflow schedules, generic approvals, provider media rendering, external publishing, and self-service checkout are not exposed as working product features. Their required backend services are specified in the readiness document.

## Authentication and deployment

Browser → existing HTTPS nginx → frontend gateway → C4 API. OAuth2 Proxy performs OIDC login; Redis stores server-side sessions. The gateway forwards the user's access token to the API after authentication. The browser never receives a bearer-token input and never stores provider credentials.

The API must validate the chosen issuer, audience, subject, tenant membership, and roles. No shared admin token or implicit tenant impersonation is introduced.

- [Deployment configuration and commands](docs/DEPLOYMENT.md)
- [Required configuration and release blockers](docs/PRODUCTION_READINESS.md)
- [Verified API contract](docs/API_CONTRACT.md)
- [C4 alignment](docs/C4_ALIGNMENT.md)

Windi CSS remains as requested; its upstream sunsetting makes ongoing build compatibility checks necessary. Dependencies are locked. GSAP and Phaser animation never alter execution state.
