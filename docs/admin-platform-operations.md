# DIRA OS Admin Platform Operations

## Environment configuration

The admin application uses server-side environment variables only. Do not prefix secrets with `NEXT_PUBLIC_`.

Set these values in the admin deployment and local `apps/admin/.env.local`:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection used by Better Auth. It must point to the same database as the API. |
| `MONGODB_DB_NAME` | Database name; defaults to `vickins_business_os`. |
| `BETTER_AUTH_URL` | Public origin of the admin app, such as `https://admin.example.com`. |
| `ADMIN_PUBLIC_URL` | Trusted public admin origin; normally the same as `BETTER_AUTH_URL`. |
| `BETTER_AUTH_SECRET` | Unique Better Auth signing/encryption secret with at least 32 bytes. |
| `ADMIN_API_SIGNING_SECRET` | HMAC secret shared only by the admin server and API. Use at least 32 random bytes. |
| `PLATFORM_ERROR_INGEST_KEY` | Error intake secret shared only by the admin server and API. Use a different random value from the signing secret. |
| `ADMIN_API_BASE_URL` | API origin and `/api` prefix, for example `https://api.example.com/api`. Production requires HTTPS. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS` | SMTP delivery for administrator password resets. Reset requests fail safely when delivery is not configured. |

Set `ADMIN_API_SIGNING_SECRET` and `PLATFORM_ERROR_INGEST_KEY` to matching values in the API deployment and the admin deployment. Keep `BETTER_AUTH_SECRET` unique to the admin application. `SUPPORT_API_KEY` remains for legacy internal consumers; the browser-facing admin proxy does not forward it.

Next.js imports the Better Auth server configuration while collecting production build page data. Provide the admin URL, MongoDB URI, and Better Auth secret to the build environment as protected variables; use the same real values at runtime. The local validation build used throwaway values and did not connect to a database.

Example files are available at [apps/admin/.env.example](../apps/admin/.env.example) and [apps/api/.env.example](../apps/api/.env.example). Generate the secrets with a password manager or secret manager; never commit the generated values.

## Initial Super Admin bootstrap

1. Configure the production or local environment variables above and confirm that the admin app and API point to the intended MongoDB database.
2. From `apps/admin`, run `pnpm admin:bootstrap` in an interactive terminal.
3. Enter the initial administrator's name, email and password. Password input is hidden. The script refuses non-interactive use, duplicate emails, and bootstrap when an active Super Admin already exists.
4. Sign in at the configured admin URL. Public registration is disabled.
5. Add further administrators through **Platform → Admin users**. Changes to roles or access revoke the target's existing sessions.

The bootstrap command creates the Better Auth `user` and credential `account` records in one MongoDB transaction. MongoDB must support transactions (a replica set or sharded cluster). The password is Argon2id hashed with the same parameters used by Better Auth. The bootstrap account is marked email-verified because it is provisioned by the operator through this protected command.

Password reset uses SMTP and sends a time-limited link. The login form does not reveal whether an email exists. If SMTP is absent or unavailable, reset requests fail without returning a reset token.

## Error intake, request IDs and retention

- API exceptions with HTTP status 500 or above are recorded as grouped incidents. Every API request receives or preserves a validated `x-request-id`; the API returns it in the response and stores it with the incident.
- The admin error boundary reports client errors through the authenticated proxy. The API also accepts authenticated mobile diagnostic reports at `POST /api/telemetry/errors`.
- `POST /api/platform-admin/errors/ingest` requires `PLATFORM_ERROR_INGEST_KEY`. It is intended for trusted server-to-server reporting. The Next.js proxy adds the key server-side only.
- Error messages and stack traces are length-limited and redact common token, password, secret and payment credential patterns. Avoid adding personal data to error messages.
- Request metric buckets expire after 90 days, grouped application errors after 180 days since their last occurrence, and login history after one year. Administrator audit records and support records remain available through their append-only application workflows.

## Operational limits represented in the console

The repository does not currently contain a verified platform subscription payment ledger, persisted user activity stream, queue worker, external uptime provider, or durable email/webhook health feed. The console labels these values as unavailable and keeps payment reconciliation read-only. Subscription plan assignment and term extensions do not mark a payment as received.

Synchronization retry replays the stored event ID and payload through the API's existing sync processor. Raw payment sync remains disabled. Stock movement writes use a MongoDB transaction so a retry cannot increment inventory twice.

Maintenance mode is enforced by the API. Application API requests receive HTTP 503 with the configured maintenance message and a `Retry-After` header. Platform-admin controls, authentication, health, and authenticated diagnostic intake remain available so operators can manage the platform and users can still report failures. The API caches the setting for up to five seconds; if the settings store cannot be read, requests fail open and the affected business endpoints still depend on the normal API/database health checks.

## Validation

The implementation passed API, admin, and mobile typechecks; API and admin production builds; and the platform-admin assertion/permission/proxy/sync/redaction, API tenant-safety, and API email smoke tests. The local admin build used protected-style placeholder environment values because Next.js loads Better Auth configuration during page-data collection.
