# Career Desk

A free-first developer job-search workspace: evidence inventory, application pipeline, versioned PDFs, and human-reviewed preparation.

## Status

Early pilot implementation. `/demo` contains fictional data; edits stay in page memory. Real account access stays closed until Postgres and authentication are configured. This is not a universal ATS auto-apply service.

## Stack

Next.js App Router, React, TypeScript, Better Auth, Postgres, Vercel, GitHub CI. No paid model API, billing integration, advertising, or tracking SDK.

## Deployment sequence

1. Create the GitHub repository and import it into the correct Vercel account.
2. Connect a free Postgres integration through Vercel Marketplace. Review costs before upgrading any plan.
3. Set DATABASE_URL, a random BETTER_AUTH_SECRET of at least 32 characters, and production BETTER_AUTH_URL. Keep ALLOW_SIGNUP=false initially. Do not commit secrets.
4. Link the local checkout to that Vercel project, pull its environment and verify required key names without printing values.
5. Run `npm ci`, then `npm run db:migrate` against the intended database. Better Auth's migration API owns the auth schema; the script also creates application tables.
6. Run `npm run typecheck`, `npm test`, and `npm run build`.
7. Verify signup/signin/signout/session expiry, two-account isolation, PDF upload/download, quotas, and backup against the deployed database. Configure recovery and email verification before broad signup.
8. Enable ALLOW_SIGNUP=true only for the approved pilot and deploy the environment change.

After linkage and environment verification, use `npm run dev` for development. Build/type checks do not require production credentials. Unit tests use an in-process Postgres implementation, not the hosted database.

## Workflow

Save search criteria and verified experience; add a posting and assess fit and gaps; copy a preparation request to your own assistant; review claims and generated PDFs; preserve document versions; apply through the employer's site; record Applied only after confirmation and a submission date; track follow-ups and interviews.

Each person's assistant subscription and usage limits are separate. Per-user daily agents are not configured in this pilot. The original personal Sites dashboard and daily task remain separate until migration is verified. Never replace scoped account authorization with a shared global agent key.

## Free-first operation

No checkout or automatic plan upgrades. Limits: 250 applications, 40 PDF versions, 2 MB per PDF, 25 MB of document bytes per account. PDF bytes share Postgres during the pilot to avoid a second storage service. These limits do not mean hosting is cost-free. Review provider usage and invoices before growing the pilot.

## Data boundaries

Public source/demo contain no personal applications or resumes. Route handlers derive ownership from Better Auth sessions. Every data query, document download and backup is scoped to the stable user ID. Client owner IDs and Sites identity headers are not trusted. File responses are authenticated and no-store. Backup exports include PDF bytes and must be handled as private files.

See [architecture](docs/architecture.md) and [pilot readiness](docs/pilot.md).
