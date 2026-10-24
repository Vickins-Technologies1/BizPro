# Dira OS email delivery

All SMTP delivery belongs to the NestJS API's global `EmailModule`. Application modules enqueue a named email template through `EmailService`; clients must never connect to SMTP. The service renders escaped HTML and a plain-text alternative, writes a MongoDB `email_outbox` record, and delivers it from a background worker.

## Configure SMTP

Copy the SMTP variables from `.env.example` into the API runtime environment. Keep `MAIL_ENABLED=false` for local work without a mail provider. To enable email, set `MAIL_ENABLED=true` and provide:

- `SMTP_HOST`, `SMTP_PORT`, and `SMTP_SECURE` (`true` for implicit TLS, commonly port 465; `false` for STARTTLS, commonly port 587).
- Optional `SMTP_USER` and `SMTP_PASS`, which must be provided together.
- `MAIL_FROM_ADDRESS`; optionally set `MAIL_FROM_NAME` and `MAIL_REPLY_TO`.
- `MAIL_TIMEOUT_MS` (1000–120000) and `MAIL_MAX_RETRIES` (0–10).

On startup the API validates the values and verifies the SMTP connection. Diagnostics identify configuration fields or an SMTP error code, never the credential values. Use a provider's verified sender address and store production credentials in the hosting platform's secret manager. Do not commit `.env` files.

For Cloud Run, create Secret Manager secrets for `SMTP_USER` and `SMTP_PASS` and configure the remaining SMTP values as runtime environment variables in the deployment workflow/service. The repository's deployment workflow does not set production email credentials automatically. Rotate SMTP secrets in the secret manager, deploy a new revision, verify its startup logs, then revoke the old provider credential.

## Delivery and operations

The MongoDB `email_outbox` collection is created by Mongoose. `idempotencyKey` has a unique index; queue jobs move through pending, processing, retrying, sent, and failed states. Retries use exponential backoff capped at one hour, with up to `MAIL_MAX_RETRIES` retries after the first attempt. Workers claim jobs atomically and recover processing records after a five-minute lease expires, including after a restart. Sent and terminally failed records expire after 30 days. No separate broker or infrastructure is required.

Logs include the outbox identifier, template, attempt, state, and a safe SMTP error code only. They exclude recipients, message content, tokens, and credentials. Failed messages retain template variables while they are retryable so that delivery can resume; treat MongoDB access as sensitive. The outbox is not a cross-region exactly-once system: SMTP can accept a message immediately before a process crash and a retry can then produce a duplicate. Stable application idempotency keys prevent duplicate queue records, but cannot guarantee provider-level exactly-once delivery.

Templates are defined in `src/modules/email/email-templates.ts`. Add a fixed template name and render both HTML and text; escape all user-supplied values and allow only HTTPS links or the Dira OS app scheme for action links. Do not put confidential business records, passwords, or reusable credentials in messages.

## Current integration coverage

- High and critical business-wide notifications are queued to the business contact email when one is configured. Low-stock alerts use their existing deduplication key.
- Password recovery is currently phone-based, with hashed, expiring, one-use reset codes and an optional existing delivery webhook. User accounts do not currently store email addresses, so SMTP is not used for recovery until the account model and verification flow support verified addresses.
- The current sales, billing, and staff-management flows do not expose an explicit email-recipient choice or an email invitation workflow. The named receipt, invoice, payment, subscription, and invitation templates are ready for these flows, but the service does not fabricate recipients or payment events.

The outbox requires MongoDB access and schema/index creation privileges. Automated tests should use a mock SMTP transport; never point tests at production credentials.
