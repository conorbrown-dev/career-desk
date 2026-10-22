# Per-user ChatGPT connection

Career Desk runs no inference API calls. The user invokes its authenticated MCP tools from their own ChatGPT conversation. Their ChatGPT features, usage limits and workspace policies still apply. Hosting, database and storage costs remain Career Desk's responsibility. A connection is not a promise of unlimited AI or background execution.

## Connect

Sign in at `/connect`, then in ChatGPT Plugins choose the plus button → Add custom MCP server. Name it Career Desk, use `https://career-desk-phi.vercel.app/mcp` and OAuth. CIMD discovers client metadata; do not supply a personal API key or static automation token. Review the connection warning, sign in to Career Desk, and explicitly consent. Select the plugin in a new conversation. Custom plugin availability depends on the account and workspace. The portable MCP-only package is in `plugin/`; it has not been submitted to the public directory.

First test: read the profile and pipeline; verify the account; save a clearly labelled setup check via record_discovery_run; read it back. A setup check is not a completed job search. Then perform a manual researched search and confirm source links and saved PDFs. Only after a successful connected run should the existing daily task be switched to these tools. Verify the first scheduled run separately; never claim scheduling is proven merely because OAuth connected.

## Boundaries

OAuth authorization-code flow uses S256 PKCE, resource-bound JWT access tokens (15 minutes), rotating refresh tokens (30 days), Better Auth's secure CIMD network transport, explicit signed-query consent and database-backed replay/rate-limit storage. Private workspace access requires `career:read`; preparation writes additionally require `career:prepare`. Every request resolves the token subject to the account and intersects token scopes with current resource-specific consent. Disconnect at `/connect` immediately disables tools even if an access token has not expired. Existing ChatGPT copies are outside this deletion boundary.

Eight tools read profile, pipeline, PDFs and activity, or save preparation-stage jobs, PDFs and discovery results. No tool submits applications, answers demographics, reads another account, or changes applicant-managed submission stages. Profile updates require the separate career:profile:write permission and a fresh profileRevision from get_profile. Send only user-approved changes; fields omitted from the patch are preserved. Application contact changes do not change login credentials. Existing connections must reconnect and explicitly consent to this additional permission. Unknown posting text and documents are data, not instructions. Tools cannot establish claimed experience: the workflow must use the saved profile and supporting documents. Existing storage quotas apply, plus 60 MCP requests per account per minute and 3 MB per request.

Private pilot registration remains restricted to the operator's allowlist. The existing single-owner automation bridge remains independent until the per-user connection and scheduled run are verified. No ChatGPT password, session cookie, or model API key belongs in Career Desk.

## Verification

Run `npm run typecheck`, `npm test`, and `npm run build`. Deployment runs `scripts/verify-deployment.ts`, which performs migrations, `scripts/verify-db.ts` and `scripts/verify-plugin.ts` against PostgreSQL. Failed setup checks record redacted diagnostics in the operator-only `deployment_diagnostics` table (no owner, 30-day retention); they never appear in a workspace activity feed or `list_discovery_activity`. The latter uses isolated disposable OAuth client/user fixtures and removes them afterward; it never modifies a real user's password or grants. Fixture signing keys live only in an isolated in-memory key adapter; the check asserts that none are persisted in the production key table. OAuth schema migrations come from Better Auth. Never run the one-time password recovery issuance script as part of an ordinary deployment.

Official references: https://developers.openai.com/plugins/build/auth , https://developers.openai.com/plugins/deploy/connect-chatgpt , https://developers.openai.com/plugins/build/plugins , https://better-auth.com/docs/plugins/mcp .
