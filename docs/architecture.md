# Engineering decisions

The personal prototype used ChatGPT Sites, platform identity, D1 and R2. The standalone app removes those assumptions so another developer can use a normal account and an independently deployed product.

Browser → route handler → authenticated server session → owner-scoped repository → Postgres.

The client never chooses the trusted owner ID. Queries include that ID and download/export routes enforce the same boundary. Mutations enforce same origin. Better Auth owns password/session handling and database-backed auth rate limiting.

## Documents and costs

The bounded pilot stores PDF bytes in Postgres: 2 MB per file, 25 MB per account, 40 versions. An upload transaction takes an owner advisory lock before checking quota and writing document bytes plus metadata. This reduces infrastructure dependencies at the expense of database and backup size. A later object-storage adapter should follow measured usage while preserving private downloads.

No model API calls are made. Users bring their own assistant for research and drafting. A future unattended agent integration needs per-user authorization, retries, source evidence, budgets and delivery verification.

## Truthfulness and review

The profile records employment evidence and exclusions. Preparation prompts preserve official titles, flag gaps, prohibit invented experience and require review. A transition to Applied requires a date. This records the user's confirmation; it does not independently prove acceptance by an employer.

## Verification limits

Repository tests attempt cross-account reads, overwrites and downloads; check duplicate tracking URLs and submission-date rules; verify new profiles contain no owner's seed data. These tests do not replace real hosted authentication and two-account checks. Signup stays closed until setup and those checks are complete.

No paid billing, automatic upgrade, customer adoption, measured savings or availability claims are made.
