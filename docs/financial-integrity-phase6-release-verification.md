# DIRA OS Phase 6 — Financial Regression and Release Verification

**Status: NOT READY FOR RELEASE (Phase 6B addendum below).** The original Phase 6 checks remain useful baseline evidence. Phase 6B resolved the Expo export blockers, passed a local MongoDB payment/invoice concurrency suite, and verified the EAS remote Android counter is 16. Historical database reconciliation, full financial workflow coverage, comparison of EAS 16 with the Play Console high-water mark, signed AAB validation, and native production builds remain blocked or incomplete.

## Executive summary

The Phase 1–5 changes establish server-side financial validation, payment lifecycle states, transaction idempotency, invoice and credit-note lifecycle handling, customer-credit separation, and consistent open-receivable calculations. This phase tightened the historical diagnostic and reconciliation scripts and corrected the finance-identifier smoke fixture to match the current credit-note archival lifecycle.

No live or production database was accessed, no payment was sent, and no migration or historical correction was run. There are no confirmed historical discrepancies because the database diagnostics could not connect. Historical records are **unknown**, not verified clean.

## Findings and disposition

| Finding | Status | Financial invariant / impact |
|---|---|---|
| Unallocated customer payments pooled against aggregate debt | Corrected in Phase 5 | Customer credit stays with its owner and does not reduce gross receivables. |
| Linked sale and invoice counted twice | Corrected in Phase 5 | One open obligation per linked sale/invoice pair. |
| Pending/failed payments treated as collected cash | Corrected in Phases 1–5 | Only eligible posted/reconciled rows and signed reversals affect collected totals. |
| Dashboard method totals used sale totals instead of payments | Corrected in Phase 5 | Method totals use eligible payment rows. |
| Raw payment sync accepted caller-supplied amount/state | Disabled in Phases 1–4 | Clients replay typed, idempotent sale, invoice, or customer-payment requests. |
| Provider callback could reconcile without verification | Corrected conservatively in Phases 1–4 | Callback is logged as pending verification and cannot mutate payment/balance state. Manual reconciliation checks amount, currency, reference, and reason. |
| Historical cached customer balances may reflect old pooling | Unknown; scan blocked | Read-only reconciliation compares cached balances to gross active sale/invoice obligations and reports unapplied credit separately. |
| Historical duplicate/mismatched records | Unknown; scan blocked | Read-only diagnostic reports suspicious totals, duplicate references, invoice links/status, allocations, reversal trace, M-Pesa evidence, and unallocated-payment counts. |
| Database-backed workflows and concurrency | Partial; see Phase 6B | A local replica-set suite now exercises actual `SalesService` payment persistence and concurrent requests; invoice, M-Pesa, inventory, and credit-note integration scenarios remain unverified. |

## Changed files and effects

This working tree includes Phase 1–5 remediation and Phase 6 verification changes. No prior user changes were reverted. `packages/shared/theme.js` and `packages/shared/theme.d.ts` were already modified before Phase 6 and are unrelated; they were preserved.

| Files | Purpose and invariant | Contract / schema / compatibility notes |
|---|---|---|
| `packages/shared/src/financial.ts`, `packages/shared/financial.js`, `packages/shared/financial.d.ts` | Shared monetary rounding, validation, discount/tax calculation, and receivable de-duplication. | `calculateSale` accepts additional options and returns order-discount allocation fields; consumers must use the matching shared version. No DB change. |
| `packages/shared/src/constants.ts`, `packages/shared/constants.js`, `packages/shared/constants.d.ts`, `packages/shared/schemas.d.ts` | Add failed, reversed, refunded payment values and generated declarations. | Broadens shared enum/schema contracts; ship generated declarations/runtime with sources. |
| `packages/shared/src/types.ts`, `packages/shared/types.d.ts` | Add payment lifecycle state, customer-credit analytics, note lifecycle dates, and finance totals. | Customer analytics gains required fields; FinanceOverview fields are optional. Strict response consumers should update. |
| `apps/api/src/common/payment-integrity.ts` | Defines eligible payment states, transition checks, request fingerprints, and duplicate-key classification. | New server policy module; no DB migration. |
| `apps/api/src/modules/invoices/invoice-lifecycle.ts` | Centralizes invoice lifecycle derivation. | No API/schema change by itself. |
| `apps/api/src/modules/schemas.ts` | Adds payment state/currency/fingerprint/actor/reversal-link fields; sale fingerprint; issued/voided timestamps for notes. | Additive fields with defaults/nulls; legacy payment-state fallback remains. `paymentState` declares a new non-unique index. No migration was run. |
| `apps/api/src/modules/sales/sales.service.ts`, `apps/api/src/modules/sales/sales.controller.ts`, `apps/api/src/modules/sales/sales.module.ts` | Validates authoritative sale totals, tenders, stock/customer effects, idempotent sale creation, and payment records. | Sale create now requires stable `externalId`; server calculates tax and accepts expected-price/total checks. Module registers invoice schemas. Stricter request validation is a compatibility change. |
| `apps/api/src/modules/invoices/invoices.service.ts`, `apps/api/src/modules/invoices/invoices.controller.ts` | Validates invoice/payment math and lifecycle; handles idempotent payments, note issue/void, linked-sale balances. | Adds note lifecycle routes and initial payment method. Invoice payment requires stable `externalId`; DTO validation is stricter. Fields are additive. |
| `apps/api/src/modules/customers/customer-balance.ts`, `apps/api/src/modules/customers/customers.service.ts`, `apps/api/src/modules/customers/customers.controller.ts`, `apps/api/src/modules/customers/customers.module.ts` | Separates gross obligations from unapplied customer credit; scopes and validates customer payments and balance repair. | Customer analytics gains credit fields; stable external IDs and positive supported payments are enforced. Module registers business schema. No new stored balance. |
| `apps/api/src/modules/finance/finance.service.ts`, `apps/api/src/modules/finance/finance.controller.ts`, `apps/api/src/modules/finance/finance.module.ts` | Separates collected, pending, failed, customer credit, and current receivables; reconciles and reverses payments. | Adds disposition/reconciliation routes and FinanceOverview fields. `paymentState` is the only new declared index. |
| `apps/api/src/modules/reports/reports.service.ts`, `apps/api/src/modules/analytics/analytics.service.ts` | Applies common obligation rules and branch/business filters; removes an unused payment lookup. | Report summary adds collected/pending/failed/credit totals. Receivables are current open obligations; activity totals retain period scope. |
| `apps/api/src/modules/sync/sync.service.ts`, `apps/api/src/modules/webhooks/webhooks.service.ts` | Blocks raw payment upserts and unverified callback state mutation. | Raw payment sync clients must use typed operations; webhooks return `pending_verification`. This changes compatibility for callers using direct upserts/automatic callback matching. |
| `apps/mobile/src/store/useAppStore.ts`, `apps/mobile/src/services/apiClient.ts` | Aligns offline/cache behavior and normalization with payment/credit policy. | Handles added API fields; no DB change. |
| `apps/mobile/src/screens/PosScreen.tsx`, `apps/mobile/src/screens/CustomersScreen.tsx`, `apps/mobile/src/screens/InvoicesScreen.tsx`, `apps/mobile/src/screens/FinanceScreen.tsx`, `apps/mobile/src/screens/ReportsScreen.tsx` | Shows pending/confirmed payment state, customer credit, current obligations, and revised finance totals. | Labels reflect updated meanings; no DB change. |
| `apps/api/test/financial-integrity.smoke.ts`, `apps/api/test/tenant-safety.smoke.ts`, `apps/api/test/finance-identifiers.smoke.ts` | Deterministic arithmetic, validation, split tender/retry, branch scope, customer advances, lifecycle, and ID handling. | Fixture tests, not Mongo integration/concurrency tests. Finance identifier fixture now models credit-note archive behavior. |
| `apps/api/scripts/financial-diagnostic.ts`, `apps/api/scripts/financial-reconcile.ts` | Read-only historical checks; reconciliation uses gross obligations, linked invoice IDs, and eligible standalone payments, with credit separate. | Requires `MONGODB_URI`; no mutation. Phase 6 expanded diagnostic categories. |
| `docs/financial-integrity-phase1-audit.md` | Earlier phase audit. | Documentation only. |
| `packages/shared/theme.js`, `packages/shared/theme.d.ts` | Unrelated token changes predating Phase 6. | Preserved pre-existing workspace modifications. |

### API and database compatibility

- Unknown response fields are additive, but required customer analytics fields can affect strict response consumers.
- Required idempotency IDs and disabled raw-payment sync are deliberate request-contract changes. Update older clients before rollout.
- Legacy documents may have no `paymentState`; the eligibility logic handles missing values. MongoDB records are not backfilled by schema defaults.
- The only new declared index is `payments.paymentState`; it is non-unique. `app.module.ts` does not explicitly set `autoIndex`. Confirm production index policy/build duration; provision the index separately if automatic index creation is disabled.
- No data backfill is required for deployment because legacy reads remain supported. Additive fields need no downtime. Index duration depends on data size and MongoDB version; it was not measured.
- Rollback: deploy the prior application version; additive fields may remain. If manually provisioned and no longer needed, review/drop `paymentState_1`. No rollback/migration was run.

## Test and build results

| Command/check | Result |
|---|---|
| `pnpm --filter @vbo/shared typecheck` and `build` | PASS |
| `pnpm --filter @vbo/api lint`, `typecheck`, and `build` | PASS |
| `pnpm --filter @vbo/mobile lint` and `typecheck` | PASS |
| `pnpm --filter @vbo/admin typecheck` | PASS |
| `pnpm --filter @vbo/desktop typecheck` | PASS |
| API `test:financial-smoke`, `test:smoke`, `test:finance-identifiers-smoke` | PASS (identifier smoke passed after fixture correction). |
| API `test:commerce-smoke`, `test:purchase-order-receipt-smoke`, `test:stock-transfer-inventory-smoke`, `test:suppliers-smoke`, `test:catalog-smoke`, `test:auth-phone-smoke` | PASS |
| Mobile `test:smoke`, `test:navigation-smoke`, `test:secure-storage` | PASS |
| `git diff --check` | PASS; line-ending normalization notices only. |
| `pnpm --filter @vbo/mobile build` | PASS in Phase 6B: Expo web, Android, and iOS bundles exported successfully after adding missing web dependencies and canonicalizing the Windows junction path in Metro. |
| Android/iOS `expo export --platform ...` | PASS as part of successful `expo export`; JavaScript bundles generated for both platforms. Native Gradle/Xcode builds and signed artifacts are distinct and remain unverified. |
| `financial:diagnostic`, `financial:reconcile`, `financial:migration:plan` | BLOCKED: exact error `MONGODB_URI is required`; no historical counts produced. |
| `financial:concurrency-test` | Phase 6 result was only a harness. In Phase 6B it passed against the isolated local replica set; scenario detail and coverage limits are in the addendum. |

The API smoke tests exercise service logic with fixtures, not complete workflows persisted through MongoDB. No database-backed POS/invoice-payment/M-Pesa callback/replay flow was run. Provider callbacks remain pending until manual verified reconciliation. No real payment or callback was sent.

## Historical data and migration safety

The diagnostic and reconciliation scripts are read-only. Run them with an explicitly selected read-only credential before release:

```powershell
$env:MONGODB_URI = '<read-only diagnostic connection string>'
pnpm --filter @vbo/api financial:diagnostic
pnpm --filter @vbo/api financial:reconcile
pnpm --filter @vbo/api financial:migration:plan
```

Review output by business, branch, payment state, and audit history. Matching totals are not proof of provider cash receipt. Do not run `financial:migration:apply` or repair endpoints until discrepancies are classified and explicit business approval is recorded. The existing metadata migration has an explicit confirmation guard but no per-record before-image; it is not automatically reversible.

## Remaining risks and release gate

1. Historical counts and cached balances remain unknown until the read-only scan runs against the intended database.
2. Idempotency/concurrency need isolated replica-set tests with seeded fixtures; the current concurrency script does not run scenarios.
3. Android/iOS bundles remain unverified because of the Metro TreeFS conflict; all-platform export also lacks web dependencies.
4. Webhook callbacks do not auto-reconcile. Confirm the manual verification workflow before enabling M-Pesa collection at scale.
5. Clients omitting idempotency keys or using raw payment sync must be updated.

**Release decision: do not declare the financial remediation production-ready until items 1–3 are cleared and M-Pesa/API compatibility is accepted.**

## Manual verification before release

1. In an isolated MongoDB replica set, seed separate businesses and branches; test cash sale, split tender/retry, partial invoice payment/retry/settlement, customer A credit vs customer B debt, pending/verified/replayed/failed M-Pesa outcomes, and linked invoice draft/issue/void credit-note flows.
2. Assert persisted sales, invoices, payments, customers, stock, and finance/report totals from the same fixtures.
3. Run concurrent identical sale/payment requests; verify one durable payment per idempotency key and reject duplicate provider references.
4. Run read-only diagnostics on a database snapshot, classify findings, and attach counts before deciding whether a repair is appropriate.
5. Confirm the `paymentState` index plan and backup/rollback window with database operations. Deploy API contract changes before older mobile builds can submit requests.
6. Resolve the Metro dependency/file-map issue and produce Android/iOS bundles before release.

---

# Phase 6B final release-gate addendum

**Decision: C. NOT READY FOR RELEASE.** The Expo JavaScript exports, Android debug Gradle build, and a MongoDB-backed sale/invoice payment suite now pass. Historical diagnostics, complete database workflow coverage, Play Console high-water verification and synchronization, a current signed AAB, upload-certificate continuity, cross-host build serialization, and native production builds are not verified. No production database, payment provider, store, or migration was accessed.

## Historical diagnostics and intended database

`MONGODB_URI` and `MONGODB_TEST_URI` were unset. No database connection was attempted for historical diagnostics. The intended database name, environment, and read-only principal remain unidentified. HD-01 through HD-14 are individually **BLOCKED** in [financial-historical-diagnostics-phase6b.md](financial-historical-diagnostics-phase6b.md); they have no queried values or transaction references. “Blocked” must not be interpreted as “zero findings.”

Static inspection shows that `financial-diagnostic.ts` and `financial-reconcile.ts` perform read-only finds, counts, and aggregations. They contain no writes, payment calls, allocation, or lifecycle mutation. This does not verify the privileges of a future connection. `financial:migration:apply` was not run. No historical discrepancy was classified or corrected.

## Isolated MongoDB configuration and real database checks

The local MongoDB 7.0 replica set `diraFinancialTest` is bound only to `127.0.0.1:27018`. Its dedicated database is `vbo_financial_test_phase6b`; the integration test hard-checks the loopback host, port, database, replica-set name, and primary role before dropping the disposable test database. Fixtures are removed by dropping only that database at the end of the run. No production URI or credential is accepted by this harness.

Setup and execution:

```powershell
& .\apps\api\scripts\financial-test-mongodb.ps1 start
$env:MONGODB_TEST_URI = 'mongodb://127.0.0.1:27018/vbo_financial_test_phase6b?replicaSet=diraFinancialTest'
pnpm --filter @vbo/api financial:concurrency-test
```

The passing integration run instantiated real Mongoose schemas and called the real `SalesService.recordPayment` and `InvoicesService.recordPayment` against MongoDB. It verified negative and overpayment rejection, partial sale payment persisted to sale/customer, two simultaneous same-key sale retries yielding one payment, a different amount under the same key being rejected, and two different sale-payment requests racing against the outstanding balance (one accepted, one rejected). Invoice checks covered partial then full settlement, overpayment rejection, identical retry producing one payment, conflicting same-key retry rejection, and two different invoice-payment requests racing against the outstanding balance (one accepted, one rejected). An unconfirmed M-Pesa invoice payment remains `reconciliation_pending` and does not lower the invoice balance. The sale remained reconciled at **KES 90 paid, KES 10 due, partial**. This is actual database evidence for these sale and invoice payment paths, not mock evidence.

Not covered by this integration suite: full POS sale creation/split tenders/stock deduction, invoice creation/issuance/edit and credit/debit notes, customer standalone payments, provider callbacks and M-Pesa reconciliation recovery, sync replay, concurrent inventory sales, branch/business cross-tenant matrix, and the broader Phase 6 scenario list. Those requirements remain **BLOCKED**, not passed. No live M-Pesa operation was sent.

## Expo and Metro

Added the two SDK-compatible web packages missing from the mobile app manifest: `react-native-web@~0.20.0` and `@expo/metro-runtime@~5.0.5`. The previous TreeFS collision came from Metro watching the Windows `node_modules/expo-modules-core` junction and its real in-workspace target as separate paths. `apps/mobile/metro.config.js` now canonicalizes watched paths and omits a separate watch entry when the real package is already inside the workspace.

`pnpm --filter @vbo/mobile build` **PASS**. Expo exported web, iOS, and Android from the `index.js` entry point, produced the expected platform JS bundles and assets, and wrote `dist/index.html` and `dist/metadata.json`. No Metro TreeFS collision or unresolved import remained in this export. `gradlew.bat assembleDebug` **PASS**; `aapt dump badging` reports `com.bizpro.vickins`, versionCode `21`, versionName `1.0.4` for the debug APK. This is a debug build and does not prove the production EAS version or signing configuration. The native build emitted a nonfatal AGP 8.8.2 / compile SDK 36 compatibility warning. Mobile TypeScript typecheck and prior admin/desktop typechecks remain PASS. A release Gradle/AAB build was not produced; iOS Xcode is unavailable on this Windows host.

## Android version management and artifact gate

Both EAS config files now require CLI `>=25.3.0` and use `appVersionSource: "remote"`. EAS CLI `25.3.0` is installed. Android development, preview, and production profiles enable `android.autoIncrement: true`, sharing EAS's remote project/platform sequence. Production remains `credentialsSource: "local"`; the Android package remains `com.bizpro.vickins`; `versionName` remains `1.0.4`. The helper at `apps/mobile/scripts/android-release.cjs` provides `check`, `prepare`, `build`, and `validate`; build preflight refuses to proceed unless the operator supplies the current Play Console high-water code and EAS remote state is authenticated and at least that high. It uses a local lock for builds invoked from one workstation and does not auto-submit.

Locally verified: EAS CLI version, JSON and JavaScript syntax, EAS profile settings, application ID and signing references in native Gradle configuration, and helper fail-closed logic. The helper rejected a previously staged workspace AAB because its embedded `versionName` was `0.1.0`, not the configured `1.0.4`. Read-only `eas build:version:get` succeeded and returned remote Android versionCode **16**. EAS indicated that native Gradle supplies the application ID. Read-only `eas build:list` showed no build was created by the interrupted wrapper check; the remote counter remained 16. Not verified: Play Console highest code or whether remote 16 is initialized above it, a new AAB manifest/version, signature validity, matching Play upload certificate, or a pair of simultaneous authenticated remote builds. A production build was not created and no Play upload occurred. Existing production signing compatibility is **BLOCKED** pending certificate comparison. Cross-host parallel builds are **BLOCKED** pending a centralized serialized release lane or demonstrated EAS reservation guarantee. Internal/closed/open/production monotonicity is configured to use the same remote sequence, but cross-profile allocation remains unverified here.

Before the first release, initialize EAS Android remote version to the highest code already used in any Play track via `pnpm exec eas build:version:set` from `apps/mobile`. Do not use the checked-in fallback `21` unless Play Console confirms it is the high-water mark. Then set `ANDROID_PLAY_LAST_UPLOADED_VERSION_CODE` and run `pnpm --filter @vbo/mobile release:android check`, `prepare`, and `build`. Treat every created build version as consumed even if a build or upload fails. After EAS build completion, retrieve the AAB and run the documented bundletool validator; separately compare its signing certificate fingerprint with the existing Play upload certificate. No AAB was generated or validated during Phase 6B.

## Test and build results from this phase

| Check | Status | Evidence / limit |
|---|---|---|
| API typecheck | PASS | `pnpm --filter @vbo/api typecheck` |
| Mongo sale and invoice payment integration/concurrency | PASS | Actual local replica set and real `SalesService` / `InvoicesService`; cases listed above. |
| API smoke regression suite | PASS | Tenant safety, auth phone, catalog, commerce, financial integrity, suppliers, purchase-order receipt, stock-transfer inventory, and finance identifiers. |
| Mobile smoke regression suite | PASS | Offline queue, workspace navigation, secure storage. |
| Workspace typechecks | PASS | API, shared, mobile, admin, and desktop. |
| Expo web export | PASS | Combined production export created HTML, web JS bundles, metadata, and assets. |
| Expo Android JS export | PASS | Android Hermes bundle created. Does not establish Gradle build. |
| Expo iOS JS export | PASS | iOS Hermes bundle created. Does not establish Xcode build. |
| Metro Windows junction/file-map correction | PASS | Full web, Android, and iOS export completed without the prior TreeFS error. |
| Expo package/lockfile | PASS | Required dependencies installed and lockfile updated. |
| EAS config/helper syntax | PASS | JSON parsing, `node --check`, and read-only remote version query. |
| Historical database diagnostics/reconciliation | BLOCKED | No intended database or read-only credential was configured. |
| Invoice, customer-payment, note, M-Pesa, sync, inventory DB workflows | BLOCKED | Not in the executed DB suite. |
| Full financial workflow/regression matrix | BLOCKED | Broad API/mobile smoke suites passed; POS inventory, standalone customer payments, notes, callbacks/reconciliation, sync replay, and tenant matrix were not covered by the real DB integration suite. |
| Android debug Gradle build | PASS | `gradlew.bat assembleDebug`; actual debug APK identity is `com.bizpro.vickins`, code 21, name 1.0.4. |
| Android Gradle release build/AAB | BLOCKED | Remote EAS code is 16, but Play high-water baseline is unknown; helper refuses to proceed without it. |
| AAB embedded code/signature/certificate validation | BLOCKED | No new AAB generated. |
| iOS Xcode production build | BLOCKED | Xcode unavailable on Windows. |
| Play identity in app config and debug APK | PASS | `com.bizpro.vickins` remains in Expo/Gradle config and the locally built debug manifest. |
| Existing Play signing compatibility | BLOCKED | Existing upload certificate could not be safely verified without artifact/Play Console evidence. |
| Cross-host concurrent EAS version allocation | BLOCKED | EAS is authenticated, but no multi-runner allocation test was performed; local lock covers only one workstation. |
| Production migration, data correction, payment, upload, deployment | REQUIRES MANUAL APPROVAL | None was performed. |

## Phase 6B files and changes

| File | Change |
|---|---|
| `apps/mobile/package.json`, `pnpm-lock.yaml` | Added required Expo web packages and aligned EAS CLI to the configured minimum. |
| `apps/mobile/metro.config.js` | Canonicalized workspace watch paths to remove duplicate Windows junction traversal. |
| `apps/mobile/eas.json`, `eas.json` | Unified the remote-version policy and configured Android auto-increment on supported Android profiles. |
| `apps/mobile/scripts/android-release.cjs` | Added safe remote-version/Play-baseline preflight, local build lock, EAS production build wrapper, and AAB manifest/signature checks. |
| `apps/api/scripts/financial-test-mongodb.ps1` | Added a local-only replica set setup command bound to loopback. |
| `apps/api/scripts/financial-concurrency-test.ts` | Replaced availability-only harness with real SalesService/replica-set payment and concurrency checks guarded to one disposable database. |
| `docs/android-play-store-release-versioning.md` | Documented EAS initialization, release commands, artifact checks, parallel-build limits, and manual verification. |
| `docs/financial-historical-diagnostics-phase6b.md` | Recorded the historical database blocker and 14 blocked result categories. |
| `docs/financial-integrity-phase6-release-verification.md` | Added this final evidence-based release gate addendum and corrected superseded Phase 6 export/concurrency status. |

No production database/schema change or migration was made in this phase. Earlier Phase 1–6 working-tree changes remain preserved. The `paymentState` index described in the Phase 6 baseline still requires deployment planning if automatic index creation is disabled. New Expo/EAS dependencies are noted above. No unrelated dependency upgrades were intended.

## Deployment, rollback, and remaining approvals

Before deployment, the owner must supply the intended database and read-only user, review the historical report, finish the database integration matrix, verify the EAS remote counter against Play Console, serialize cross-runner release submissions, validate a newly built AAB and upload certificate, and run supported native builds. Check API/mobile idempotency contract compatibility and plan the additive `paymentState` index before rollout. Do not apply the financial migration or modify historical records until each discrepancy has an approved, auditable remediation plan.

No deployment occurred. If application code is later deployed and must be rolled back, redeploy the prior application version; retain additive fields, and review any separately provisioned `paymentState_1` index with database operations before considering removal. Preserve the current Play package and upload key. A failed/cancelled EAS build consumes its remote code; the next build should advance again. Production database correction, migration, payment, store submission, and deployment each require the appropriate explicit approval.

**Release decision remains C — NOT READY FOR RELEASE.** The unresolved mandatory checks are historical and full database financial verification, Android AAB/signing validation, sufficient build disk space, cross-host build serialization, and native release builds.

## Phase 6C final gate — 2026-11-01 16:07 UTC

**Overall decision: C. NOT READY FOR RELEASE.** Phase 6C included owner-confirmed Play reconciliation and an EAS remote version update from 16 to 21. Three production build attempts failed or were stopped during local archive preparation after consuming codes 22, 23, and 24; the latest remote counter is 24. No Play upload, production payment, database write, migration, historical correction, or package/signing identity change occurred. No direct Play Console connection was available; the owner confirmed 21 as the highest version code across tracks for `com.bizpro.vickins`.

| Release outcome | Status | Evidence / remaining action |
|---|---|---|
| Financial application correctness | PASS (limited verified scope) | Phase 6B local replica-set sale/invoice payment concurrency checks and listed API/mobile regression suites passed. This is not full POS, sync, M-Pesa, tenant, or inventory workflow coverage; those gaps remain BLOCKED as listed above. |
| Historical financial integrity | BLOCKED | No approved target database/read-only identity. No historical records were examined. See the historical diagnostic register. |
| Android production build | BLOCKED | Three attempts did not create a build record or AAB because local EAS snapshot/archive preparation exhausted or approached available disk space. SDK 36 is configured; artifact, signing and 16 KB page compatibility remain unverified. |
| Play Store version reconciliation | PASS (owner-confirmed) | Owner confirmed Play maximum 21 across tracks; EAS remote was set to 21 and is now 24 after failed/interrupted attempts. Codes 22–24 are consumed; next build allocates 25. |
| Signing compatibility | BLOCKED | Local credential reference exists, but no production AAB or Play upload-certificate fingerprint comparison is available. |
| Build collision prevention | BLOCKED | EAS remote source and profile increment settings are configured. The helper serializes only one workstation; no isolated cross-machine race test or central CI lock exists. |
| iOS readiness | BLOCKED | Xcode is unavailable on Windows. No native iOS archive, signing, or App Store validation was performed. macOS/EAS commands are in the versioning report. |

The owner reported the latest production entry as “Release name: 21 (1.0.4), 35 hours ago,” then confirmed that 21 is the highest version code across tracks. The release-name field alone is an editable label, so reconciliation was based on the owner's confirmation, not inferred from that label ([Google Play Console release guidance](https://support.google.com/googleplay/android-developer/answer/9859348?hl=en)).

Phase 6C regression evidence (2026-11-01):

- **PASS**: `pnpm --filter @vbo/api typecheck`, `pnpm --filter @vbo/shared typecheck`, `pnpm --filter @vbo/mobile typecheck`, `pnpm --filter @vbo/admin typecheck`, and `pnpm --filter @vbo/desktop typecheck`.
- **PASS**: Existing API smoke commands: `pnpm --filter @vbo/api test:smoke`, `test:auth-phone-smoke`, `test:catalog-smoke`, `test:commerce-smoke`, `test:financial-smoke`, `test:suppliers-smoke`, `test:purchase-order-receipt-smoke`, `test:stock-transfer-inventory-smoke`, and `test:finance-identifiers-smoke`.
- **PASS**: Existing mobile smoke commands: `pnpm --filter @vbo/mobile test:smoke`, `test:navigation-smoke`, and `test:secure-storage`.
- **PASS**: `pnpm --filter @vbo/api financial:concurrency-test` with `MONGODB_TEST_URI=mongodb://127.0.0.1:27018/vbo_financial_test_phase6b?replicaSet=diraFinancialTest`. It used only the loopback-bound disposable test replica set and reported real sale/invoice payment races, idempotent retries, overpayment rejection, customer debt isolation, and pending M-Pesa checks passing.
- **PASS**: `pnpm --filter @vbo/mobile release:android config` validates both EAS config files and local signing/package references without connecting to EAS. Its first invocation exposed a stale variable reference in the new check; that was corrected, and the subsequent invocation passed for `com.bizpro.vickins`, versionName `1.0.4`, and remote allocation policy.
- **PASS**: `node --check apps/mobile/scripts/android-release.cjs`; `git diff --check` reported only the repository's existing CRLF normalization notices, with exit code 0.

The build/test matrix has no standalone shared/admin/desktop smoke scripts in their package manifests; their typechecks passed. Remote version evidence: the initial read from `apps/mobile` returned **16**; `eas build:version:set --platform android --profile production` set it to **21** after owner confirmation, and read-back returned **21**. With `ANDROID_PLAY_LAST_UPLOADED_VERSION_CODE=21`, the release helper passed at remote 21 and again at remote 22. Three subsequent production attempts consumed **22–24** but did not create a build record: two failed with `ENOSPC` while compressing the local archive, and one was stopped at about 46 MB free before upload. A read-only query returned remote **24**; the latest build list still showed only the pre-existing October record. The next attempt will allocate **25**. The root `.easignore` now excludes generated `**/.cxx/` CMake cache files, but additional free disk space or a larger temporary/build volume is required. Expo's app-version documentation says EAS remote values are the source of truth and local app-config build numbers are ignored/overwritten with the remote value during EAS builds ([official Expo documentation](https://docs.expo.dev/build-reference/app-versions/)).

Remaining actions: run the production build only from a machine or temporary volume with sufficient free disk space (next code 25), capture its build ID, inspect the AAB manifest/target SDK/release type/16 KB compatibility, and compare its upload certificate SHA-256 fingerprint with Play Console. Supply an approved historical database target with verified read-only credentials and either configure a serialized CI release lane or demonstrate cross-runner allocation in an isolated non-Play EAS project. iOS stays unverified pending a macOS/Xcode build and App Store checks. No Play upload or deployment occurred.
