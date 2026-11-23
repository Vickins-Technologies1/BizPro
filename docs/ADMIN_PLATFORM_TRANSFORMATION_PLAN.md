# DIRA OS Admin Platform Transformation Plan

## Repository audit

- `apps/admin` is a Next.js 14 application with one dashboard route. Its employee panel exists but is not mounted. The current dashboard requests data separately for at most five businesses.
- The admin proxy currently forwards arbitrary paths and methods to a hardcoded Cloud Run API host and attaches `SUPPORT_API_KEY`. The API key is the only documented admin access boundary.
- `apps/api` is a NestJS 10 application using Mongoose and the existing MongoDB database. Existing mobile authentication is phone/password-or-PIN plus JWT, with tenant roles and permissions. That identity model must remain unchanged for the mobile app.
- Existing business, employee, subscription, device, sync, reconciliation, and audit services are reusable. Subscription states are `TRIAL`, `ACTIVE`, `EXPIRED`, `PAST_DUE`, and `CANCELLED`; sync events use `pending`, `failed`, and `applied`. Payment callbacks currently log as unverified and do not settle balances.
- There is no Better Auth dependency, platform-admin identity, centralized persistent error collector, platform incident workflow, or platform settings/ticket module. The API health endpoint only reports process reachability.
- Validation currently consists of TypeScript checks/builds and API smoke scripts. There is no admin test suite. The workspace has per-app dependency links, but the normal pnpm launcher attempts to install its pinned version into a protected global cache; the pinned `npx` runner also needs registry access.

## Implementation decisions

1. Add Better Auth email/password identities in separate Better Auth collections in the existing MongoDB database. Do not migrate customer employees or change mobile login.
2. Use Argon2id for platform-admin passwords, disable public signup, enable database-backed revocable sessions, and add an explicit server-side bootstrap command. Role and permission decisions remain in a shared platform-admin access map.
3. Put a server-side authentication boundary in the admin application. It will validate Better Auth sessions, enforce same-origin writes, allow only enumerated admin API paths and methods, and sign short-lived admin assertions for the API. The Nest API will independently verify those assertions and enforce its own role-to-permission map on every protected route.
4. Replace the fixed upstream URL with validated `ADMIN_API_BASE_URL` configuration. Keep the legacy support key for internal/legacy consumers, but stop forwarding it through the browser-facing proxy.
5. Extend existing business services and schemas where possible. New platform-only data will use additive collections for admin audit, incidents/errors, tickets, configuration, and request metrics. No destructive migration or production-data rewrite is planned.
6. Build a real console shell and route each navigation item only to a functional module. Financial displays will use stored records; no UI action will mark payments paid or claim a verified callback.

## Implemented delivery

1. **Identity and perimeter:** Better Auth email/password identity, Argon2id, database sessions, disabled public signup, reset mail, MFA/passkey plugins, interactive Super Admin bootstrap, six platform roles, same-origin writes, an allowlisted Next.js proxy, short-lived signed API assertions, an independent API permission guard, and admin login/audit history.
2. **Console foundation:** authenticated route group, responsive navigation and module layout, separate profile and incident menus, theme switching, shared tables/forms, loading/empty/error states, business search, and dashboard date ranges.
3. **Platform overview and businesses:** API aggregates use full server-side datasets; business search/filter/pagination and profiles are connected; suspension, restoration, and editable profile changes are audited.
4. **People and subscriptions:** business employee management is separated from platform-admin accounts; admin provisioning and session revocation are available; subscription plan and term controls are audited; callback reconciliation remains read-only.
5. **Devices and synchronization:** paginated device/event views and checkpoints are available; retries atomically claim the original event; stock movement replay uses a MongoDB transaction.
6. **Observability:** API request IDs, sanitized grouped errors from API exceptions and authenticated clients, incident triage/notes, request metrics, and database/API health reporting are implemented. Queue, email delivery, webhook completion, and external uptime are reported as unavailable when there is no source of truth.
7. **Configuration, support, reports and audit:** platform settings, runtime maintenance enforcement, tickets/notes, filtered reports/CSV, and administrator action/login histories are connected.
8. **Validation and operations:** a focused platform-admin smoke script covers signed assertions, role permissions, proxy allowlisting, and error redaction. Environment/bootstrap/retention and known data-source limits are documented in [admin-platform-operations.md](admin-platform-operations.md).

## Validation results

- API and admin TypeScript checks passed.
- Mobile TypeScript check passed for the authenticated error-reporting changes.
- API and admin production builds passed. The local admin build used temporary placeholder URLs and credentials during Next.js page-data collection; production secrets still need to be configured in the deployment environment.
- Platform-admin assertion, role-permission, proxy-policy, sync-retry concurrency/idempotency, and redaction smoke checks passed, including the bearer-token leakage regression case.
- Existing API tenant-safety and email smoke checks passed.

## External prerequisites and limits

- Admin deployment requires its own MongoDB connection, Better Auth secret, API signing secret, and environment-specific API URL. Secrets must be configured in the deployment platform; this repository cannot provision or rotate deployed secrets.
- Email password reset requires the existing SMTP/outbox provider to be configured. Until delivery is configured, reset requests must fail safely rather than reveal a token.
- API uptime monitoring can measure this service's own request/health history, but external multi-region uptime checks require an external monitoring provider. The console must label this distinction accurately.
- Payment refunds/settlement are only implementable if a verified provider workflow exists. Current callbacks are explicitly unverified, so the console will remain read-only for that state.
