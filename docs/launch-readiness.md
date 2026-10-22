# Public beta readiness

Production source and operating record for the launch work. Do not advertise open registration until the remaining gates are verified. The public fictional demo remains available; real account signup remains invite-only.

## Verified

- Private profile, pipeline, application stages/history, versioned PDF storage and owner-scoped downloads.
- Per-user ChatGPT OAuth consent, read/preparation permissions, token refresh and immediate disconnect. A live account read/write/read-back check succeeded on October 22, 2026.
- Profile setup requires target roles, location preferences and an experience summary before marking onboarding complete.
- Export → atomic restoration into a separate empty disposable workspace → exact PDF byte comparison. Restored IDs and protected URLs are rebuilt. Existing workspaces cannot be overwritten. See recovery-runbook.md.
- Owner-serialized writes protect restore checks, quotas and document version updates. Assistant preparation permissions are checked inside the same transaction as the write, so a concurrent human submission cannot be reverted by a stale assistant request.
- Technical setup diagnostics stay in private records, while the workspace displays the concise user-facing result.
- Automated type, unit, build, PostgreSQL and OAuth checks run during deployment.

## Still required before inviting general signup

- Complete the new-user browser flow on an isolated test account with no personal records: signup, verification, onboarding, job entry, PDF attachment/download, export and ChatGPT consent/disconnect.
- Check provider backup retention and perform an isolated provider-level recovery drill; logical application restore is tested separately.
- Verify the first scheduled discovery run independently of the successful manual connection check. Daily searches remain user-configured in ChatGPT, not an automatic entitlement for every app account.
- Review account deletion/retention, operational contact, abuse and total storage limits, privacy copy and the public onboarding instructions before opening the signup gate.

No paid plan or automatic provider upgrade has been authorized. Keep ALLOW_SIGNUP/PILOT_SIGNUP_EMAILS restricted while these items remain open. Do not count a setup check as job discovery or mark an application submitted without confirmation.

## Account email setup — 2026-10-22

Resend Free is connected to Career Desk Production and Preview. orangecastle.net DKIM and send-subdomain MX/SPF are verified; existing Cloudflare routing records were preserved. EMAIL_DELIVERY_ENABLED explicitly gates delivery and verification enforcement. Better Auth owns verification and reset tokens; reset email uses a URL fragment, removed after reading. Reset tokens last 30 minutes and revoke sessions on use. Disposable database checks cover verification enforcement, reset token expiry/replay rejection, generic unknown-email response, changed credentials, and session revocation. Real mailbox delivery and browser completion still require confirmation before public signup.

## Live account email verification — 2026-10-22

Production deployment 18d0ccc99cb1b170edc563b2c1d3272d20bd7c0f passed hosted database, OAuth and account-email checks. Resend reported both verification and reset messages delivered to the operator mailbox at approximately 7:46–7:47 AM America/Chicago. The verification link returned successfully to sign-in; the reset link opened the new-password form. The operator completed password entry and submission personally; the browser displayed Password updated and existing sessions revoked. A subsequent connected-account read confirmed the original two applications and two GoGuardian PDF documents were intact. Per-user ChatGPT access still worked; password reset revokes browser sessions, not separate OAuth consent. Gmail API inbox inspection was rate-limited; delivery evidence came from Resend rather than an inbox-read claim.

A separate fictional onboarding workspace is planned using an operator-owned plus-address; the test invitation has not been granted. Its browser signup/verification/onboarding/document/connection sequence is still pending. Remove the test invitation after the isolated test is complete.
