# Account backup and restoration

Users can export their profile, application pipeline and every saved PDF from the workspace. The JSON download is private, contains application contact details and PDF bytes, and must be stored securely. It contains no authentication password, OAuth grant or session token. Discovery activity is not part of the v1 export.

Restoration is operator-assisted in this beta. Verify the account holder and intended destination before running a restore. Never accept a caller-provided database owner ID or restore a file into another person's account. The destination account must already exist and its workspace must be empty and not onboarded. Existing profile/application/document data is never overwritten.

With the correct production DATABASE_URL loaded privately, run:

```
node --import tsx scripts/restore-backup.ts VERIFIED_ACCOUNT_EMAIL /absolute/path/to/private-backup.json
```

The restore validates the complete file, all document references, posting URLs, counts, PDF bytes and storage quotas before writing. The transaction locks the destination owner, remaps application and PDF IDs, rebuilds protected download links, preserves recorded application stages (including legacy records with an unknown submission date), and records that restoration happened. All records commit together or the transaction rolls back. It does not submit any applications or restore authentication credentials.

Afterward, sign in as the verified destination account and check its criteria, application count, recorded stages and PDF downloads. Compare PDF hashes to the source export. Confirm the original account and an unrelated account remain unchanged. Remove private temporary files according to the agreed support retention window; do not commit backups, include them in logs or attach them to public issues.

Every deployment exercises export → restore into a separate disposable owner → PDF byte comparison → refusal to overwrite the source. This tests logical application recovery; it is not a claim that provider-level disaster recovery or off-site backups are configured. Before public launch, separately verify the database provider's retention and a recovery drill in an isolated database/branch, and record the result.

## Verified provider recovery window (2026-10-22)

Neon Free project mute-voice-81539752 reports six hours of history. A historical child branch recovered the workspace at approximately 09:00 America/Chicago on 2026-10-22. Inspect recovered data on that separate branch before considering a production switch. Do not restore/reset main in place as a verification exercise. The drill branch br-steep-mud-b8h5ne2c expires automatically after one day. This proves a short-window provider recovery path, not offsite disaster recovery, recovery outside the window, or recovery of data not yet committed at the selected time.

## Nightly encrypted off-provider backups

A scheduled workflow in the private `career-desk-backups` repository dumps the production database with `pg_dump --format=custom`, checks the dump is readable with `pg_restore --list`, encrypts it to the maintainer's `age` public key and uploads it as a workflow artifact that expires after 30 days. The database credential is a read-only role stored as a repository secret. The private key never enters GitHub, Vercel or this repository; keep it offline with a second copy.

Restore drill or disaster recovery, never into production first:

1. Download the artifact from the backup repository's workflow run and decrypt locally: `age -d -i <private-key-file> -o career-desk.dump career-desk-<timestamp>.dump.age`.
2. Create a temporary, expiring Neon branch (or empty database) and restore: `pg_restore --no-owner --no-privileges -d "<temporary-branch-url>" career-desk.dump`.
3. Compare row counts and ordered document ID/PDF MD5 aggregates against the source, as in the provider drill above.
4. Delete the decrypted dump and let the temporary branch expire. Promote or copy data into production only after deciding exactly what to recover; never resurrect a deleted account without a newly verified request.

Backups contain hashed credentials, sessions and OAuth records as well as workspace data. Treat a decrypted dump as production data.
