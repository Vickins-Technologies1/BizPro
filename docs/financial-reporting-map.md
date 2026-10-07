# Dira OS financial reporting map

| File/function | Metric | Current formula/source | Status |
|---|---|---|---|
| `finance.service.ts/overview` | Revenue | Active sale `grandTotal` | Canonical definition documented |
| `finance.service.ts/overview` | COGS | Sale item historical `costPrice * quantity` | Uses immutable sale snapshot |
| `finance.service.ts/overview` | Gross profit | Revenue minus COGS | Uses shared calculation layer |
| `finance.service.ts/overview` | Net profit | Gross profit minus active expenses | Uses shared calculation layer |
| `finance.service.ts/overview` | Cash received | Active payment amounts | Distinct from revenue |
| `financial.ts/calculateOutstanding` | Outstanding | Active hybrid receivables; linked invoice representation supersedes linked sale; unlinked sale/invoice obligations remain independent | Canonical source |
| `finance.service.ts/overview` | Outstanding | Delegates to canonical hybrid receivables and subtracts standalone customer-debt payments | Canonical consumer |
| `finance.service.ts/overview` | Bank balance | Cached account balance plus bank ledger after ledger rollout | Partially consolidated |
| `finance.service.ts/overview` | Petty cash | Entry direction aggregation | Ledger classification added; opening balance remains a follow-up |
| `reports.service.ts` | Revenue/COGS/profit | Aggregates active sale snapshots; outstanding delegates to canonical receivables | Revenue/COGS aggregation remains report-scoped |
| `analytics.service.ts` | Revenue/COGS/trends | Aggregates active sale snapshots; customer balances delegate to canonical outstanding | Trend aggregation remains report-scoped |

Revenue, cash received, outstanding, COGS, gross profit, net profit, bank balance, and petty cash are intentionally distinct metrics. No historical profit is fabricated where cost snapshots are unavailable.
