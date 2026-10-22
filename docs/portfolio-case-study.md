# Career Desk: evidence-led application preparation

Career Desk began as a personal tool and is being prepared for a free-first developer pilot. It organizes search criteria, verified experience, requirements, document versions and application progress.

The engineering problem is the boundary between assistance and consequential communication: a generated document is not an approved claim, a filled form is not a confirmed submission, and a private assistant session is not a multi-user product identity.

The standalone app uses Next.js, TypeScript, Better Auth and Postgres. Sessions establish ownership; every repository query and document download checks it. Tests attempt cross-account reads and writes, and posting URLs are normalized for per-account deduplication.

Operating cost informed the design. The pilot makes no paid model calls, relies on the user's assistant, and bounds PDF/database usage. Postgres holds small documents initially to avoid another hosted dependency; storage can be separated when usage justifies it.

The demo is fictional. Hosted auth, database setup and recovery are explicit readiness gates. This is an early implementation, not evidence of adoption or a mature production service.
