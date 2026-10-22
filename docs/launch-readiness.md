# Public beta readiness

Production source and operating record. Public beta registration opened October 22, 2026 with verified email, a 50-account cap and bounded document storage. The fictional demo remains available without an account.

## Verified

- Private profile, pipeline, application stages/history, versioned PDF storage and owner-scoped downloads.
- Per-user ChatGPT OAuth consent, read/preparation permissions, token refresh and immediate disconnect. A live account read/write/read-back check succeeded on October 22, 2026.
- Profile setup requires target roles, location preferences and an experience summary before marking onboarding complete.
- Export → atomic restoration into a separate empty disposable workspace → exact PDF byte comparison. Restored IDs and protected URLs are rebuilt. Existing workspaces cannot be overwritten. See recovery-runbook.md.
- Owner-serialized writes protect restore checks, quotas and document version updates. Assistant preparation permissions are checked inside the same transaction as the write, so a concurrent human submission cannot be reverted by a stale assistant request.
- Technical setup diagnostics stay in private records, while the workspace displays the concise user-facing result.
- Automated type, unit, build, PostgreSQL and OAuth checks run during deployment.

## Current release status — 2026-10-22

Public beta is open. The isolated signup, mailbox verification/reset, onboarding, job persistence, PDF upload/download, export, separate-account OAuth/disconnect, first scheduled discovery, provider recovery and live deletion checks are complete. Historical notes below record intermediate states and are superseded by this section.

Deletion success and expired/reused-link guidance are deployed and verified. Onboarding/privacy/support pages were reviewed. The user approved public registration and completed Vercel email verification. Removed the disposable plus-address from PILOT_SIGNUP_EMAILS while preserving the operator invitation; added PUBLIC_SIGNUP=true in Production only. Production redeployment 8Bz7R3a5zWDHn48ZEpYtMorHSeXx reached Ready and serves career-desk-phi.vercel.app. Live /about confirms open public beta with the 50-account capacity limit. Email verification, rate limits and the global PDF budget remain enabled. No new test signup or application submission was performed during the final opening check.

No paid plan or automatic provider upgrade has been authorized. Daily searches remain user-configured in ChatGPT. Never count a setup check as discovery or mark a submission without confirmation.

## Account email setup — 2026-10-22

Resend Free is connected to Career Desk Production and Preview. orangecastle.net DKIM and send-subdomain MX/SPF are verified; existing Cloudflare routing records were preserved. EMAIL_DELIVERY_ENABLED explicitly gates delivery and verification enforcement. Better Auth owns verification and reset tokens; reset email uses a URL fragment, removed after reading. Reset tokens last 30 minutes and revoke sessions on use. Disposable database checks cover verification enforcement, reset token expiry/replay rejection, generic unknown-email response, changed credentials, and session revocation. Real mailbox delivery and browser completion still require confirmation before public signup.

## Live account email verification — 2026-10-22

Production deployment 18d0ccc99cb1b170edc563b2c1d3272d20bd7c0f passed hosted database, OAuth and account-email checks. Resend reported both verification and reset messages delivered to the operator mailbox at approximately 7:46–7:47 AM America/Chicago. The verification link returned successfully to sign-in; the reset link opened the new-password form. The operator completed password entry and submission personally; the browser displayed Password updated and existing sessions revoked. A subsequent connected-account read confirmed the original two applications and two GoGuardian PDF documents were intact. Per-user ChatGPT access still worked; password reset revokes browser sessions, not separate OAuth consent. Gmail API inbox inspection was rate-limited; delivery evidence came from Resend rather than an inbox-read claim.

The operator explicitly approved temporary signup access for the isolated plus-address on 2026-10-22. The Vercel pilot invitation was updated while preserving the original operator invitation. A production redeployment applies the allowlist change; the signup form uses Alex Developer — Onboarding Test. Its browser signup/verification/onboarding/document/connection sequence is still pending. Remove the test invitation after the isolated test is complete.

## Isolated browser onboarding — 2026-10-22

Operator completed signup, followed verification email (initially placed in Gmail Spam, then marked not spam), and signed in as Alex Developer — Onboarding Test. Browser confirmed a separate empty workspace. Fictional target role, remote preference and evidence summary saved; onboarding prompt cleared. A clearly labeled fictional opportunity saved and survived a full reload alongside the profile. Export produced career-desk-backup.json in the operator's Downloads; contents were not inspected in this browser pass. Connection management correctly showed no connections for this account. PDF attachment/download and separate-account OAuth consent/disconnect remain pending. Public signup remains restricted. Remove temporary signup invitation after completing the remaining test.

## Scheduled discovery verification — 2026-10-22

Automation run cc83ff96-4740-8329-b69d-4a5fc26fcd32 is recorded completed for 2026-10-22 08:00 America/Chicago. Its result matches Career Desk discovery record 901faeac-d830-46c6-8018-a50adf440f96: three opportunities added and four PDFs prepared; unresolved eligibility questions preserved; no submissions. This independently clears the first scheduled-run gate. It does not establish delivery guarantees or daily scheduling for other accounts.

The 12 local tests passed again during continuation. Browser attachment testing is blocked before upload: W3C's public dummy PDF displays correctly, but its viewer download did not produce a browser download event. No PDF has been uploaded to the test account in this pass; do not count this as an app upload failure or a successful attachment check.

## Browser upload continuation — 2026-10-22

Operator confirmed dummy.pdf saved locally. The Add resume control successfully opened the file chooser. Browser automation stalled at chooser.setFiles for the local Downloads file; workspace still showed zero PDFs before that attempt. This distinguishes the local automation limitation from an observed application/server upload error. Manual chooser completion is pending before persistence/download can be checked.

## Test account PDF persistence/download — 2026-10-22

Browser confirmed dummy.pdf attached as Resume in the fictional opportunity, one PDF counted in test account storage. After a full reload and reopening the opportunity, the protected document link remained and downloaded successfully as dummy (1).pdf. This verifies browser persistence/download and successful local attachment (completed between turns); automated chooser.setFiles remains unverified. No byte/hash comparison was performed in this browser pass.

## Second-account OAuth and operating controls — 2026-10-22

The test plugin read only Alex Developer’s fictional profile, opportunity and dummy PDF. Read-only consent correctly rejected preparation writes. After separate preparation consent, activity 561797ea-f24a-4c2e-aa30-18d77c4b5575 was written and read back. Disconnect was clicked and the page confirmed No connections yet. Do not probe with the connected tool after revocation as that launches a new authorization prompt; production hosted OAuth tests cover denial of stale grants. The Personal plugin was not changed.

Uploads and restores now share a transaction-serialized global PDF budget of 100 MiB by default, configurable through TOTAL_DOCUMENT_BYTES. This controls PDF bytes, not total PostgreSQL or provider spend. Local tests and typecheck pass; deployment verification is pending. Connection instructions now explain read versus preparation consent.

Neon console SSO reaches an email activation wall. Operator must activate their existing Neon account before provider retention and the isolated provider recovery drill can proceed. Public signup remains restricted. Account deletion/retention, operational contact and broader abuse limits remain unfinished.

## Neon point-in-time recovery drill — 2026-10-22

Activated provider console confirms main has six hours of history on the Free plan. Created recovery-drill-20261022 (br-steep-mud-b8h5ne2c) as a separate historical child of main at approximately 09:00 America/Chicago, without changing production/default branch or app credentials. It expires automatically October 23 at 09:06 CDT. Restored branch queries returned 2 profiles, 6 opportunities and 7 PDFs. The test PDF is 13,264 bytes with MD5 2942bfabb3d05332b66eb128e0842cff. Production comparison passed: all seven PDFs total 124,264 bytes; the aggregate of ordered document IDs and PDF MD5 values is 14c9db9617ff20fb2da3cca88db19db7 on both branches. This is provider point-in-time recovery within six hours, not an offsite backup or recovery guarantee beyond that window.

## Account lifecycle controls — 2026-10-22

Account & data page identifies the signed-in account, offers export and connection management, and requests a 30-minute one-time deletion email. Confirmed deletion removes live account/workspace data transactionally via the user-deletion trigger. Opaque deleted-owner markers prevent delayed profile/job/PDF/activity writes from resurrecting records. The hosted lifecycle test caught and fixed a missing activity-write guard; both OAuth and legacy automation now use the guarded repository path. Synthetic deletion verified unrelated workspace preservation and session cascade. Public support uses the maintainer's existing portfolio contact. Privacy copy discloses active retention, six-hour provider history and one-day temporary branches.

PUBLIC_SIGNUP remains off. A database signup capacity guard limits the beta to 50 accounts; the auth hook permits public signup only behind PUBLIC_SIGNUP=true and working email configuration. Deletion requests are auth-rate-limited. The test account requested its real deletion confirmation email, but the operator must confirm deletion to complete the mailbox flow. The additional hosted email expiry/replay/session-revocation checks passed at production commit 9ed8a03e6f75ecb92a437a7d727f927404bff393. No real personal account was deleted.

## Live deletion completion — 2026-10-22

Production main read-only queries verified the disposable account is absent, its deleted-owner marker exists, and its fictional job/PDF counts are zero. The old password correctly no longer signs in. A subsequently opened callback displayed FAILED_TO_GET_USER_INFO; Better Auth requires a live session before consuming the one-time token. The presentation fix preserves Better Auth validation/deletion, sends successful new confirmations to a dedicated result page, and redirects callback errors to cautious expired/used/signed-out guidance without claiming deletion succeeded. Hosted email checks exercise success redirects, cleared cookies and replay guidance.

## Visual refresh and live import check — 2026-10-22

Production 4fae7f0 replaced the brown-orange palette with one light/dark token set (indigo accent, semantic status colors, larger minimum text, styled onboarding progress). Layout is unchanged. GitHub checks and all five hosted deployment checks passed; landing, demo, sign-in and About pages were reviewed in both themes. Branch preview deployments cannot run the hosted checks because Preview lacks the auth configuration, so verified changes deploy through main.

An authenticated import was run in the operator's workspace against three real Greenhouse links and closed without saving; opportunity and PDF counts were unchanged. Closed postings redirected and were flagged correctly. The open posting imported only its title: current Greenhouse job pages carry no schema.org JobPosting, while Lever and Ashby pages do in their raw HTML. Greenhouse links (job-boards, boards and embed forms) now read the public Job Board API through the same restricted fetcher and convert it to a JobPosting. Company, location and description are filled; pay is filled only for a single USD range labeled as salary or annual. Remote eligibility and degree stay unverified. API failures fall back to the posting page.

## Setup diagnostics moved out of activity — 2026-10-22

A failed hosted check had written a "Setup failed" entry into the operator's workspace activity, where it appeared beside job-search history and in `list_discovery_activity`. Failures now go to an operator-only `deployment_diagnostics` table with no owner and 30-day retention. The migration moves earlier entries matching that exact generated summary out of activity in one statement; ordinary activity is untouched. The hosted database check asserts both.

## Off-provider backups live — 2026-10-22

Production 52d7d2f published the 30-day backup disclosure before the first run. The private `career-desk-backups` workflow dumped production with a read-only role, verified the dump, encrypted it to the maintainer's age key and uploaded `career-desk-20261022T2235Z` (201,264 bytes, expires 2026-11-21). The same pipeline restored byte-identically in a local PostgreSQL 16 drill; a decrypt-and-restore drill of a real production backup requires the maintainer's private key and has not yet been run.

## Custom domain — 2026-10-22

Production moved to https://career-desk.orangecastle.net (Cloudflare CNAME to Vercel, DNS only). BETTER_AUTH_URL now names that origin, so sessions, email links, trusted origins, the OAuth issuer and the MCP resource (`/mcp`) use it. career-desk-phi.vercel.app permanently redirects there. Existing sessions end once; ChatGPT connections bound to the old resource must be re-added with the new `/mcp` endpoint and the old grant disconnected.

## Claude connector — 2026-10-22

Claude users can add the existing `/mcp` endpoint as a custom connector (see claude-connector.md). The live server already met Claude's OAuth discovery, CIMD and PKCE requirements. Added a pre-tool `403 insufficient_scope` step-up for Claude clients so write tools prompt for explicit consent instead of failing, a "Requested by <host>" line and accurate profile wording on the consent screen, and assistant-neutral copy with Claude setup steps. The old ChatGPT grant bound to the vercel.app resource was disconnected after the domain move. Unit tests cover the step-up; a live Claude connection is pending.

## Claude connector live check — 2026-10-22

Claude read the operator profile and all five applications through the connector. The connection was granted read and refresh only; a test activity save received the intended 403 step-up challenge, but that Claude session surfaced it as an error rather than a consent prompt, so nothing was saved. Every 401 now requests the full permission set so the first consent screen covers saving; the step-up remains for narrower legacy grants.
