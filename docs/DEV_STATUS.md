# Development Status

## Current Implementation
- Security layer validates method, Framer HMAC signature, rate limits, and suppresses duplicates once a submission is marked processed.
- Coordination layer persists submissions to Google Sheets (primary + optional backup) and records audit entries when configured.
- Owner notification emails are assembled from the booking flow JSON and sent through Resend unless `RESEND_DRY_RUN=true`.
- Structured logging now emits one JSON object per stage (`received`, `failed`, `completed`), capturing ray ID, retry attempt, submission ID, payload snapshot, and Resend message ID (if delivered).

## Recent Work
- **Enhanced logging system**: Improved log message clarity with consolidated, readable entries showing customer info, submission IDs, and status at a glance.
- **Fixed Framer form compatibility**: Made `price` field optional to handle forms that don't include pricing (shows "TBD" with calculation note).
- **Added comprehensive debugging**: Created detailed error messages for missing headers and fields to speed up troubleshooting.
- **Improved observability**: Added debug header logging for verbose mode and structured success summaries.

## Work in Progress / Known Gaps
- Transaction IDs still include the server-side receipt timestamp, so Framer retries produce new hashes; we need to derive the value from payload fields only.
- Duplicate suppression treats "pending" submissions as unique until `markProcessed` runs, allowing double writes if the worker crashes mid-flight.
- Audit logging skips when `GOOGLE_SHEET_ID_AUDIT` is blank even though the docs suggest falling back to the backup sheet.
- Rate limiting relies on KV read/overwrite operations which are not atomic; concurrent bursts can slip through.
- Documentation still promises email header redaction, but the current implementation includes the full payload in owner emails.

## Next Actions
1. Fix transaction ID generation and KV duplicate checks to eliminate repeat Sheets entries on retries.
2. Harden the audit sheet fallback logic and add unit/integration coverage for the coordination layer.
3. Decide whether to redact sensitive content in emails or adjust the docs to match the current behaviour.
4. Evaluate stronger rate limiting (e.g. Durable Object counter or KV atomic increments) if bursts remain a concern.
5. Backfill tests around the new logging helpers to ensure future refactors preserve observability semantics.
