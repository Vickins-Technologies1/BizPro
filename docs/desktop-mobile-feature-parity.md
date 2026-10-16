# Dira OS desktop/mobile feature parity

## Scope and method

Reference: `apps/mobile/src/navigation/RootNavigator.tsx`, `WorkspaceNavigator.tsx`, `MoreDrawer.tsx`, every screen in `apps/mobile/src/screens`, `services/apiClient.ts`, `services/offlineQueue.ts`, and `store/useAppStore.ts`. Desktop: `apps/desktop/src/components/DesktopShell.tsx`, `DesktopCatalog.tsx`, `src/lib/desktop-api.ts`, and the Electron/Next packaging configuration.

This is the initial source audit. No item is marked Complete until its Windows workflow has been exercised successfully. Status counts below are the pre-implementation audit, not a claim that desktop functionality has been verified.

**Initial status:** 0 Complete · 17 Partial · 9 Missing · 1 Broken · 0 Blocked (27 feature groups).

| Mobile feature / source | Windows equivalent | Initial status | Gap found | Fix / verification |
|---|---|---:|---|---|
| Login, `LoginScreen`, auth client | Desktop login | Partial | Login only; no registration, recovery, reset flow, or server session revalidation after startup. | Implement auth paths supported by API; verify against configured test backend. |
| Onboarding, `OnboardingScreen` | None | Missing | Business creation and industry selection are unavailable. | Outstanding. |
| Role launchpad and profile | None | Missing | No role/branch launchpad or profile screen. | Outstanding. |
| Dashboard and reports summary | Overview | Partial | Summary API is used, but branch/date behavior and error/empty states are incomplete. | Verify API-backed metrics and branch context. |
| POS, saved drafts, receipts, payments | Point of sale | Partial | Simplified one-unit cash-only sale; no quantity editing, discounts, taxes, split payments, customer credit, draft persistence, receipt actions, or correct non-retail operation flow. | Outstanding; retain shared/API sale rules. |
| Catalog creation by industry | Catalog modal | Partial | Industry-specific fields exist, but edit/archive/detail, category/brand/supplier lookup, and verified server validation are missing. | Verify supported industry schemas and persist changes. |
| Product detail/history, `ProductDetailScreen` | None | Missing | No detail, movements, or stock history workflow. | Outstanding. |
| Customers and payments | Customers table | Partial | Search/list only; add button has no action; no edit, groups, details, payment collection, or balance history. | Implement customer CRUD/payment and verify API behavior. |
| Sales history and receipts | Sales table | Partial | List only; no sale details, refund/return, receipt, filters, or pagination. | Outstanding. |
| Inventory, stock adjustments, transfers | Inventory table | Partial | Catalog list only; no adjustment or transfer workflow. | Outstanding. |
| Suppliers, contacts, categories, statements, payments | Suppliers table | Partial | List only; no supplier actions or purchasing relationships. | Outstanding. |
| Purchase orders | None | Missing | No order create/update/receive workflow. | Outstanding. |
| Stock transfers | None | Missing | No branch-to-branch transfer workflow. | Outstanding. |
| Expenses | Expenses table | Partial | Add button has no action; no category form or validation. | Implement create form and verify persistence. |
| Invoices, collections, credit/debit notes | None | Missing | No invoice workflow. | Outstanding. |
| Finance, balances, payment records | Finance overview | Partial | Summary-only display; no payments, invoices, bank accounts, petty cash, reconciliation, or date filters. | Outstanding. |
| Reports and CSV | Reports | Partial | Summary export only; date range control is an alert and chart/payment visualization is incomplete. | Use real report filters and verify CSV content. |
| Analytics | Insights | Partial | Catalog counts are calculated from only the first eight products; no enterprise analytics. | Use analytics APIs and verify large datasets. |
| Industry operations | Operations table | Partial | Read-only; New operation button is inert; no status updates or industry-specific forms. | Implement using shared business operation models. |
| Employees and role access | Team table | Partial | Invite action is inert; no create/update/suspend/permissions workflow. | Outstanding. |
| Team access screen | None | Missing | No access matrix or role permission editor. | Outstanding. |
| Branches and branch selection | Header selector | Missing | Selector cycles session branches but branch management is absent and selection is not persisted; branch isolation needs verification. | Outstanding. |
| Settings and sync controls | Settings placeholder | Partial | Preferences are local-only; no business profile editing or retry/error details. | Implement supported controls and safe account switching. |
| Notifications | Notification list | Partial | No read/unread actions or notification navigation. | Outstanding. |
| Subscription | Static settings page | Missing | No plan or subscription data/actions. | Outstanding. |
| Offline cache and queued writes | Local storage queue/cache | Partial | Browser storage is not account-scoped; queue flush treats all failures as retryable, and logout leaves cache/queue behind. | Fix account isolation, retry/error visibility, and verify restart/sync. |
| Theme, keyboard, resize/accessibility | Theme toggle and responsive CSS | Partial | Theme exists; top search shortcut, focus behavior, supported input methods, and 1024px minimum window need functional verification. | Verify keyboard and window sizes. |
| Dashboard recent activity | Static demo rows | Broken | Hardcoded sample sales/stock/expense/customer events appear as real activity. | Replace with backend data or show an honest empty state. |

## Architecture findings

- Mobile is Expo / React Native with Zustand, SQLite-backed persistence, secure storage, and an explicit offline action queue. Its API client owns normalization, shared business rules, and mobile offline-safe workflows.
- Windows is Next.js 14 rendered in Electron. It has a separate browser `fetch` API client and `localStorage` session/cache/queue. It does not reuse the mobile SQLite queue or native services.
- `apps/desktop/next.config.mjs` currently rewrites `/api` to the production Cloud Run endpoint. There is no desktop `.env.example` or documented API override.
- The API has the required feature modules for much of the mobile surface, but the current desktop client exposes only a subset of those endpoints.
- Electron sets a 1024×680 minimum. The desktop renderer is independently packaged via Next standalone and electron-builder; no successful Windows distributable launch has yet been recorded for this audit.

## Verification record

| Check | Result |
|---|---|
| Repository architecture/source inspection | Done |
| Desktop typecheck | Passed, including the Next production build's integrated type check |
| API/mobile typecheck | Passed for `@vbo/api` and `@vbo/mobile` |
| Mobile smoke tests | Passed: offline queue and secure storage |
| API smoke tests | Passed: tenant safety, catalog creation, financial integrity |
| Desktop live workflow/API verification | Login window opened in the packaged app; no test credentials or isolated test backend were available, so authenticated workflows were not exercised |
| Windows renderer build | Passed with Next.js 14.2.35 |
| Windows NSIS package | Passed; `apps/desktop/release-parity/Dira OS Setup 0.1.0.exe` (331,547,280 bytes), x64, unsigned |
| Packaged app launch and window size | Passed from `release-parity/win-unpacked/Dira OS.exe`; standalone renderer started on a local port, displayed the branded login screen, and remained laid out correctly when maximized |

## Implementation update

Desktop customer, supplier, and expense creation now call their existing API routes, enforce the corresponding shared permissions, validate required fields, and queue only network/offline failures. Offline read caches and queued writes are scoped to the signed-in business and user. The queue count is reflected in the shell and dashboard. The POS no longer queues server validation errors as offline sales. Dashboard activity uses actual sales and expenses rather than sample rows. Notifications can be marked read, reports use the API's from/to filters with CSV export, and insights use the enterprise analytics endpoint.

These improvements remain **Partial** until authenticated Windows flows, API data, offline restart/retry, role restrictions, and account switching are exercised against a dedicated test backend. No feature is promoted to Complete from typechecking or source inspection alone. Outstanding missing modules and workflows in the table remain in scope.

Update each row and the verification record as implementation and checks complete. Features that cannot be exercised due to external dependencies must remain Blocked with the specific dependency recorded.
