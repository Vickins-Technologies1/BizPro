# Phase 6B historical financial diagnostics

**Status: BLOCKED — no historical database was queried.**

## Target and safety

Neither `MONGODB_URI` nor `MONGODB_TEST_URI` was set in the execution environment. The intended historical database, environment, and read-only credentials could not be identified. Per the Phase 6B safety requirements, no connection was attempted and no diagnostic result is represented as a pass or as zero findings.

Static inspection of `apps/api/scripts/financial-diagnostic.ts` and `apps/api/scripts/financial-reconcile.ts` confirms that their database operations are `find`, `countDocuments`, and aggregation reads. They do not insert, update, delete, migrate, send payments, change payment statuses, allocate payments, or edit invoices/credit notes. The separate `financial:migration:apply` script was not run. This code inspection does not substitute for verifying the intended database or its read-only database role.

## Result register

No transaction references, business/branch identifiers, or monetary expected/actual values are available because the target was not read. For each row, **finding status is BLOCKED**, not “no findings.” If a later scan produces records, include one row per record with the indicated fields and require accounting approval where noted.

| ID | Category | Status | Expected / actual values | Severity / action |
|---|---|---|---|---|
| HD-01 | Negative payment amounts | BLOCKED | Not queried | Investigate each signed payment and its reversal link. |
| HD-02 | Payments exceeding original transaction balance | BLOCKED | Not queried | Reconcile source sale/invoice and eligible net allocations. |
| HD-03 | Duplicate payment references | BLOCKED | Not queried | Match business, provider, reference, and evidence before disposition. |
| HD-04 | Duplicate idempotency keys | BLOCKED | Not queried | Classify retries versus distinct operations. |
| HD-05 | Paid invoices with positive balances | BLOCKED | Not queried | Compare invoice history and posted allocations. |
| HD-06 | Draft credit notes affecting posted balances | BLOCKED | Not queried | Inspect note lifecycle and invoice audit history. |
| HD-07 | Incorrect sale/invoice links | BLOCKED | Not queried | Verify business identity and link uniqueness. |
| HD-08 | Potentially double-counted receivables | BLOCKED | Not queried | Reconcile linked sales/invoices and customer obligations. |
| HD-09 | Unallocated payments reducing receivables | BLOCKED | Not queried | Keep customer credit separate from gross obligations. |
| HD-10 | Customer cached balance mismatches | BLOCKED | Not queried | Compare each customer with underlying open transactions. |
| HD-11 | M-Pesa confirmed without evidence | BLOCKED | Not queried | Verify provider reference, amount, and confirmation history. |
| HD-12 | Failed/pending/reversed/refunded cash totals | BLOCKED | Not queried | Recompute totals from eligible lifecycle states and reversals. |
| HD-13 | Incorrect business/branch associations | BLOCKED | Not queried | Trace branch ownership and transfer/audit history. |
| HD-14 | Historical allocation inconsistencies | BLOCKED | Not queried | Reconcile payment, source transaction, and customer balance history. |

## Safe execution when the owner supplies a target

First obtain the intended environment and a database user restricted to read operations. Verify the selected database name and deployment environment without printing the URI. Then run:

```powershell
$env:MONGODB_URI = '<read-only URI for the approved intended database>'
pnpm --filter @vbo/api financial:diagnostic
pnpm --filter @vbo/api financial:reconcile
```

Capture the JSON output in the release evidence report. Do not run `financial:migration:apply` or correct history as part of the diagnostic. Each discrepancy must be classified and separately approved before remediation.

## Phase 6C recheck — 2026-11-01 15:24 UTC

**Outcome remains BLOCKED.** The intended database name/environment and read-only principal were not supplied or discovered in the available workspace. `financial:diagnostic` and `financial:reconcile` were not run; no records, monetary totals, masked identifiers, or finding severities can be reported. Do not interpret this as a clean scan. No database URI was printed, tested, or connected during this recheck, and no migration or repair was attempted.

To run the two documented read-only commands, the owner must provide the approved target and credentials for a principal whose database grants have been independently verified to exclude writes and schema changes. The operator must first confirm the target database identity without logging the URI and inspect the diagnostic/reconcile code path again before execution. Preserve raw diagnostic output in access-controlled evidence, mask identifiers in this report, then classify each finding for accounting review. Historical corrections remain a separately approved operation.
