# Monitoring and alerting

Both pieces are free and add no npm dependency.

## Server errors: Sentry

`instrumentation.ts` (Next.js `onRequestError`) and `failure()` in `lib/http.ts` send crashes and infrastructure faults to Sentry through `lib/error-report.ts`, which posts directly to Sentry's envelope endpoint. Reported: programming errors (TypeError, ReferenceError and similar), PostgreSQL faults other than data exceptions and constraint violations (SQLSTATE classes 22 and 23), Node system errors and pg pool connection failures. Not reported: validation messages, malformed JSON, invalid user URLs and other expected input errors. Reported API faults now return a generic 500 instead of the internal message.

Each event carries only the error type, a redacted message (environment secrets, emails, bearer tokens, long tokens and query strings removed), stack frames, the route path, environment and release. No request body, headers, cookies, user or account identifiers.

Setup: create a free Sentry account and a Node.js project, copy its DSN, and add `SENTRY_DSN` to the Vercel Production environment, then redeploy. In Sentry, keep the default "new issue" email alert. The Developer plan covers 5,000 errors a month for one user. Reporting is a no-op when `SENTRY_DSN` is unset.

## Availability: GitHub Actions

`.github/workflows/uptime.yml` runs at :07 and :37 each hour from `main`. It checks the landing, privacy and terms pages, the assistant connection metadata and that `/mcp` answers `401`, retrying each three times. A failed run sends GitHub's workflow-failure email to the account that last changed the schedule. The checks avoid database queries so they do not keep the Neon compute awake. GitHub disables scheduled workflows after 60 days without repository activity; re-enable from the Actions tab if that happens.

Backup failures are reported by the backup repository's own workflow emails.
