# Claude custom connector

Claude users connect the same per-user OAuth MCP server that ChatGPT uses: `https://career-desk.orangecastle.net/mcp`. There is no separate server, tool set or data path. Account isolation, resource-bound consent, revocation checks and scope enforcement are identical.

## How users connect

Claude → Customize → Connectors → Add custom connector (Team/Enterprise: an Owner adds it under Organization settings → Connectors). Name it Career Desk, enter the endpoint, and keep the default sign-in and OAuth client settings ("Use Claude's published identity"). Free plans allow one custom connector. The `/connect` page carries the user-facing steps.

## Why it works without registration

Claude reads the protected resource metadata from the `401` on `/mcp`, then the authorization server metadata at `/.well-known/oauth-authorization-server/api/auth`. That metadata advertises `client_id_metadata_document_supported: true` and `none` in `token_endpoint_auth_methods_supported`, so Claude identifies itself with Anthropic's hosted Client ID Metadata Document and authenticates as a public PKCE (S256) client. No DCR endpoint is exposed or needed. Claude's hosted apps use the redirect URI `https://claude.ai/api/mcp/auth_callback`, declared in that document.

## Permissions and step-up

The `401` names `scope="career:read"`, so Claude first requests read access (plus `offline_access` for refresh). When a Claude client then calls a write tool without its scope, `/mcp` answers before the tool runs with:

```
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope", scope="<granted scopes + needed scope>", resource_metadata="…/.well-known/oauth-protected-resource/mcp"
```

Claude shows the Career Desk consent screen for the broader scope, and retries the call only after the user clicks Allow. `career:prepare` covers `save_opportunity`, `save_preparation_pdf` and `record_discovery_run`; `career:profile:write` covers `update_profile`. Consent is never broadened silently.

The challenge is sent only when the token's `client_id` is an `https://claude.ai/…` or `https://claude.com/…` metadata document (`supportsScopeStepUp`). Other clients, including ChatGPT, keep the existing tool-level "not granted" error. Tools still enforce their scope themselves in every case.

The consent screen names the host of a URL `client_id` ("Requested by claude.ai") because a metadata document's `client_name` is self-asserted.

## Verification

`tests/scope-step-up.test.ts` covers client detection, the tool-to-scope map, batched calls and the challenge format. A live Claude connection (connect → read profile → step-up on first save → disconnect) has to be run from a Claude account; record the result in launch-readiness.md. Claude Code uses a loopback redirect on a random port; Claude Code compatibility with the Better Auth CIMD redirect matching has not been verified.

References: [Authentication for connectors](https://claude.com/docs/connectors/building/authentication), [Lazy authentication and step-up](https://claude.com/docs/connectors/building/lazy-authentication), [Get started with custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
