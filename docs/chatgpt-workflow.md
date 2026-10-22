# ChatGPT workflow connection (private pilot)

The deployed app exposes `/api/automation` for a single explicitly configured account. This is a scoped pilot bridge, not Sign in with ChatGPT and not a public multiuser connector. It does not call a paid inference API.

Configure an independent random `CAREER_AUTOMATION_TOKEN` (at least 40 characters) and `CAREER_AUTOMATION_EMAIL` on the server. The owner is resolved from the existing auth user table; no caller-supplied owner IDs are accepted. The account must exist before requests succeed. Never put the credential in task prompts, URLs, source control, browser storage, or logs. Rotate or remove the environment variable to revoke access.

An authorized ChatGPT Work task can privately obtain the encrypted credential through the user's Vercel connector, then send an HTTPS Authorization bearer header to this app. This requires those tools and HTTP network access in the task runtime; a successful interactive check alone does not verify a scheduled run.

GET returns profile, jobs, usage and discovery runs. `GET ?status=1` returns connection/profile readiness only. POST supports `save_job`, `save_pdf` (base64, Resume or Cover letter), and `record_run`. Payloads have the same `{action,data}` structure as the earlier private Site. Preparation stages only: the bridge cannot mark Applied, alter interview/submitted records, modify the profile, delete data, submit employer applications, or send messages. Ready for review requires already-stored resume and cover letter metadata. Private document downloads still require the applicant's browser session.

Keep the original task and data intact until the invited account exists, its evidence profile and documents have been migrated and checked, and a bridge read/write/read-back succeeds. Then switch the existing task's destination, preserving its schedule. Retain honest run status: setup tests are not job searches.
