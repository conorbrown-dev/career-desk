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

- Install the email delivery integration and verify a sender domain; send a real verification/reset email and confirm its delivery.
- Implement and test self-service forgot-password and email-verification flows, including expired/used links and revoked sessions.
- Complete the new-user browser flow on an isolated test account with no personal records: signup, verification, onboarding, job entry, PDF attachment/download, export and ChatGPT consent/disconnect.
- Check provider backup retention and perform an isolated provider-level recovery drill; logical application restore is tested separately.
- Verify the first scheduled discovery run independently of the successful manual connection check. Daily searches remain user-configured in ChatGPT, not an automatic entitlement for every app account.
- Review account deletion/retention, operational contact, abuse and total storage limits, privacy copy and the public onboarding instructions before opening the signup gate.

No paid plan or automatic provider upgrade has been authorized. Keep ALLOW_SIGNUP/PILOT_SIGNUP_EMAILS restricted while these items remain open. Do not count a setup check as job discovery or mark an application submitted without confirmation.

## Account email setup — 2026-10-22

Resend Free is connected to Career Desk Production and Preview. orangecastle.net DKIM and send-subdomain MX/SPF are verified; existing Cloudflare routing records were preserved. EMAIL_DELIVERY_ENABLED explicitly gates delivery and verification enforcement. Better Auth owns verification and reset tokens; reset email uses a URL fragment, removed after reading. Reset tokens last 30 minutes and revoke sessions on use. Disposable database checks cover verification enforcement, reset token expiry/replay rejection, generic unknown-email response, changed credentials, and session revocation. Real mailbox delivery and browser completion still require confirmation before public signup.
