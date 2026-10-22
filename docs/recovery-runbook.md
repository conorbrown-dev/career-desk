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
