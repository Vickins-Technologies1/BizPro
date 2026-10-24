# Desktop UI redesign verification

## Architecture inventory

- Desktop renderer: Next.js 14.2, React 18, Electron wrapper.
- Actual App Router URL: `/`. After authentication, the desktop shell switches among 21 permission-filtered views in client state; they are not separate URL routes.
- Theme: `DesktopShell` persists `bizpro.desktop.theme` in local storage. API data remains session and branch scoped.
- Shared presentation: `apps/desktop/src/app/globals.css`; the shared shell and view switch live in `apps/desktop/src/components/DesktopShell.tsx`.
- Feature modules: catalog/products, POS, sales history, purchase orders, stock transfers, invoices, and branches have dedicated components. The shell also renders customer, supplier, expense, report, finance, insights, operations, team, access, notification, settings, profile, subscription, and workspace views.
- Modal/backdrop usage is present in DesktopShell, DesktopCatalog, DesktopInvoices, DesktopBranches, DesktopPos, DesktopPurchaseOrders, DesktopSalesHistory, and DesktopStockTransfers.

## Route and screen checklist

The source inventory is complete. A checkmark in a visual column means that screen was opened and reviewed in the named theme; source inspection or a successful build does not count as a visual check.

| Screen/view | Light visual | Dark visual | Functional walk |
|---|---:|---:|---:|
| `/` sign-in | ✓ | — | Partial: sign-in UI opened; no credentials submitted |
| Password recovery request/reset | Request screen ✓; reset screen — | — | Request screen opened; no request or reset was submitted |
| Owner onboarding | — | — | Not exercised; account was not created |
| Workspace scope chooser | — | — | Blocked by authenticated session requirement |
| Overview dashboard | — | — | Blocked by authenticated session requirement |
| Point of sale | — | — | Blocked by authenticated session requirement |
| Products/catalog | — | — | Blocked by authenticated session requirement |
| Inventory | — | — | Blocked by authenticated session requirement |
| Purchase orders | — | — | Blocked by authenticated session requirement |
| Stock transfers | — | — | Blocked by authenticated session requirement |
| Customers | — | — | Blocked by authenticated session requirement |
| Suppliers | — | — | Blocked by authenticated session requirement |
| Expenses | — | — | Blocked by authenticated session requirement |
| Sales history | — | — | Blocked by authenticated session requirement |
| Reports | — | — | Blocked by authenticated session requirement |
| Finance and invoices | — | — | Blocked by authenticated session requirement |
| Insights | — | — | Blocked by authenticated session requirement |
| Operations | — | — | Blocked by authenticated session requirement |
| Team | — | — | Blocked by authenticated session requirement |
| Team access | — | — | Blocked by authenticated session requirement |
| Business settings and branches | — | — | Blocked by authenticated session requirement |
| Profile | — | — | Blocked by authenticated session requirement |
| Notifications | — | — | Blocked by authenticated session requirement |
| Subscription | — | — | Blocked by authenticated session requirement |

Authenticated screen verification requires an authorized account and reachable API. No credentials or test environment were available in this run, so authenticated CRUD, dialogs, empty/populated/error states, and live theme switching remain unverified.

## Implementation and checks

- Refined the shared navigation rail, group spacing, active/focus treatment, scrolling, tooltips, and branch selector behavior at compact widths.
- Replaced sidebar and header glyphs with a consistent inline outline icon set.
- Standardized shared page, card, control, table, and modal density through the existing global stylesheet.
- Changed dark mode tokens to neutral black/charcoal surfaces and added dark overrides for common semantic banners, badges, product tiles, and metric icons.
- `pnpm --filter @vbo/desktop typecheck`: passed.
- `pnpm --filter @vbo/desktop build`: passed after repairing the incomplete local pnpm install with `pnpm install --force --frozen-lockfile`; lockfile unchanged.
- Browser review: the single URL `/` sign-in and password-recovery request state rendered in light mode. An authenticated shell was unavailable, so light/dark visual counts for the 21 authenticated views are both 0; `/` dark-mode inspection was not applicable before sign-in.

## Known existing issues observed in source

- The Operations “New operation” button has no action handler.
- Production data workflows and feature-specific modals were not exercised; this redesign pass only validates the shared renderer build and sign-in screen.

