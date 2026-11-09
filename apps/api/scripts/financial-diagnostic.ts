import mongoose from "mongoose";
import { eligiblePaymentMatch } from "../src/common/payment-integrity";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
type Finding = { severity: Severity; collection: string; problem: string; recommendation: string; automaticRemediationSafe: boolean };
const active = { deletedAt: null };

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required; diagnostic refuses to guess a database");
  await mongoose.connect(uri, process.env.MONGODB_DB ? { dbName: process.env.MONGODB_DB } : undefined);
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB connection did not expose a database");
  const findings: Finding[] = [];
  const count = (collection: string, filter: Record<string, unknown>) => db.collection(collection).countDocuments(filter);
  const add = (severity: Severity, collection: string, problem: string, recommendation: string, countValue: number) => {
    if (countValue > 0) findings.push({ severity, collection, problem: `${problem} (${countValue} records)`, recommendation, automaticRemediationSafe: false });
  };
  const duplicates = (collection: string) => db.collection(collection).aggregate([
    { $match: { externalId: { $type: "string", $ne: "" } } },
    { $group: { _id: { businessId: "$businessId", externalId: "$externalId" }, records: { $sum: 1 } } },
    { $match: { records: { $gt: 1 } } }, { $count: "groups" }
  ]).toArray();
  const [salesDup, paymentsDup, expensesDup, creditsDup, badSales, missingSnapshots, badQty, badExpenses, badPayments, badCredits, negativeStock, pendingSync, negativeCustomers, negativeBank, pettyDup,
    duplicateMpesaRefs, paidInvoicesWithBalance, draftCreditsWithLifecycleDates, multiplyAllocatedPayments, unverifiedMpesa, unallocatedPayments, orphanInvoices, branchMismatchedInvoices, untracedReversals, overallocatedSales, overallocatedInvoices] = await Promise.all([
    duplicates("sales"), duplicates("payments"), duplicates("expenses"), duplicates("credit_notes"),
    count("sales", { ...active, $or: [{ grandTotal: { $lt: 0 } }, { balanceDue: { $lt: 0 } }, { amountPaid: { $lt: 0 } }] }),
    count("sales", { ...active, $or: [{ currency: { $exists: false } }, { calculationVersion: { $exists: false } }, { "items.unitPrice": { $exists: false } }, { "items.costPrice": { $exists: false } }] }),
    count("sales", { ...active, "items.quantity": { $lte: 0 } }),
    count("expenses", { ...active, $or: [{ amount: { $lt: 0 } }, { amount: { $not: { $type: "number" } } }] }),
    count("payments", { $or: [{ amount: 0 }, { amount: { $lt: 0 }, $and: [{ $or: [{ paymentState: { $nin: ["reversed", "refunded"] } }, { reversalOfPaymentId: { $in: [null, ""] } }] }] }] }),
    count("credit_notes", { ...active, $or: [{ amount: { $lte: 0 } }, { amount: { $not: { $type: "number" } } }] }),
    count("products", { ...active, stockOnHand: { $lt: 0 } }), count("sync_events", { status: { $in: ["pending", "failed"] } }),
    count("customers", { ...active, balance: { $lt: 0 } }), count("bank_accounts", { ...active, currentBalance: { $lt: 0 } }), duplicates("petty_cash_entries"),
    db.collection("payments").aggregate([
      { $match: { ...active, method: "mpesa", reference: { $type: "string", $ne: "" }, paymentState: { $in: ["reconciled", "posted"] } } },
      { $group: { _id: { businessId: "$businessId", reference: "$reference" }, records: { $sum: 1 } } },
      { $match: { records: { $gt: 1 } } }, { $count: "groups" }
    ]).toArray(),
    count("invoices", { ...active, status: "paid", balanceDue: { $gt: 0 } }),
    count("credit_notes", { ...active, status: "draft", $or: [{ issuedAt: { $ne: null } }, { voidedAt: { $ne: null } }] }),
    count("payments", { ...active, saleId: { $nin: [null, ""] }, invoiceId: { $nin: [null, ""] } }),
    count("payments", { method: "mpesa", $or: [
      { paymentState: { $in: ["posted", "reconciled"] }, $or: [{ reconciledAt: null }, { reconciledAt: { $exists: false } }, { reference: null }, { reference: { $exists: false } }, { reference: "" }] },
      { paymentState: { $exists: false }, status: { $in: ["paid", "reconciled", "manual_mpesa"] }, $or: [{ reconciledAt: null }, { reconciledAt: { $exists: false } }, { reference: null }, { reference: { $exists: false } }, { reference: "" }] }
    ] }),
    count("payments", { ...active, customerId: { $nin: [null, ""] }, saleId: null, invoiceId: null, method: { $ne: "credit" } }),
    db.collection("invoices").aggregate([
      { $match: { ...active, saleId: { $type: "string", $ne: "" } } },
      { $lookup: { from: "sales", let: { bid: "$businessId", sid: "$saleId" }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ["$businessId", "$$bid"] }, { $eq: ["$deletedAt", null] }, { $or: [{ $eq: ["$externalId", "$$sid"] }, { $eq: [{ $toString: "$_id" }, "$$sid"] }] }] } } },
        { $project: { _id: 1 } }, { $limit: 1 }
      ], as: "sourceSale" } },
      { $match: { sourceSale: { $size: 0 } } }, { $count: "records" }
    ]).toArray(),
    db.collection("invoices").aggregate([
      { $match: { ...active, saleId: { $type: "string", $ne: "" } } },
      { $lookup: { from: "sales", let: { bid: "$businessId", sid: "$saleId" }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ["$businessId", "$$bid"] }, { $eq: ["$deletedAt", null] }, { $or: [{ $eq: ["$externalId", "$$sid"] }, { $eq: [{ $toString: "$_id" }, "$$sid"] }] }] } } },
        { $project: { branchId: 1 } }, { $limit: 1 }
      ], as: "sourceSale" } },
      { $unwind: "$sourceSale" },
      { $match: { $expr: { $ne: [{ $ifNull: ["$branchId", null] }, { $ifNull: ["$sourceSale.branchId", null] }] } } },
      { $count: "records" }
    ]).toArray(),
    count("payments", { ...active, paymentState: { $in: ["reversed", "refunded"] }, amount: { $lt: 0 }, $or: [{ reversalOfPaymentId: null }, { reversalOfPaymentId: { $exists: false } }, { reversalOfPaymentId: "" }] }),
    db.collection("payments").aggregate([
      { $match: { ...active, saleId: { $nin: [null, ""] }, invoiceId: null, $and: [eligiblePaymentMatch()] } },
      { $group: { _id: { businessId: "$businessId", saleId: "$saleId" }, netAllocated: { $sum: "$amount" } } },
      { $lookup: { from: "sales", let: { bid: "$_id.businessId", sid: "$_id.saleId" }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ["$businessId", "$$bid"] }, { $eq: ["$deletedAt", null] }, { $or: [{ $eq: ["$externalId", "$$sid"] }, { $eq: [{ $toString: "$_id" }, "$$sid"] }] }] } } },
        { $project: { grandTotal: 1 } }, { $limit: 1 }
      ], as: "source" } },
      { $unwind: "$source" }, { $match: { $expr: { $gt: ["$netAllocated", "$source.grandTotal"] } } }, { $count: "records" }
    ]).toArray(),
    db.collection("payments").aggregate([
      { $match: { ...active, invoiceId: { $nin: [null, ""] }, saleId: null, $and: [eligiblePaymentMatch()] } },
      { $group: { _id: { businessId: "$businessId", invoiceId: "$invoiceId" }, netAllocated: { $sum: "$amount" } } },
      { $lookup: { from: "invoices", let: { bid: "$_id.businessId", iid: "$_id.invoiceId" }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ["$businessId", "$$bid"] }, { $eq: ["$deletedAt", null] }, { $or: [{ $eq: ["$externalId", "$$iid"] }, { $eq: [{ $toString: "$_id" }, "$$iid"] }] }] } } },
        { $project: { grandTotal: 1 } }, { $limit: 1 }
      ], as: "source" } },
      { $unwind: "$source" }, { $match: { $expr: { $gt: ["$netAllocated", "$source.grandTotal"] } } }, { $count: "records" }
    ]).toArray()
  ]);
  add("CRITICAL", "sales", "duplicate business-scoped external IDs", "Classify replay versus distinct operation before deduplication", Number(salesDup[0]?.groups ?? 0));
  add("HIGH", "payments", "duplicate external IDs", "Classify replay versus distinct payment before repair", Number(paymentsDup[0]?.groups ?? 0));
  add("HIGH", "expenses", "duplicate external IDs", "Review before adding constraints", Number(expensesDup[0]?.groups ?? 0));
  add("HIGH", "credit_notes", "duplicate external IDs", "Review replay history before repair", Number(creditsDup[0]?.groups ?? 0));
  add("CRITICAL", "sales", "negative or invalid financial totals", "Quarantine and reconcile historical records", badSales);
  add("HIGH", "sales", "missing currency, calculation version, or price/cost snapshots", "Assess each field; never use current catalogue values blindly", missingSnapshots);
  add("CRITICAL", "sales", "invalid quantities", "Reconcile stock effects and sale totals", badQty);
  add("CRITICAL", "expenses", "invalid amounts", "Repair only through an auditable operation", badExpenses);
  add("HIGH", "payments", "zero or negative amounts", "Classify non-financial records and reconcile valid payments", badPayments);
  add("CRITICAL", "credit_notes", "zero or negative amounts", "Review against source invoices", badCredits);
  add("HIGH", "products", "negative stock", "Reconcile stock movements and sales", negativeStock);
  add("HIGH", "sync_events", "pending or failed financial events", "Inspect retry errors and event ordering", pendingSync);
  add("HIGH", "customers", "negative cached balances", "Reconcile from authoritative transactions", negativeCustomers);
  add("MEDIUM", "bank_accounts", "negative cached balances", "Confirm account policy and reconcile with a ledger", negativeBank);
  add("HIGH", "petty_cash_entries", "duplicate external IDs", "Classify duplicate transactions before repair", Number(pettyDup[0]?.groups ?? 0));
  add("HIGH", "payments", "duplicate confirmed M-Pesa provider references", "Match provider evidence and payment allocations before resolving", Number(duplicateMpesaRefs[0]?.groups ?? 0));
  add("HIGH", "invoices", "paid status with a positive balance", "Reconcile invoice history, allocations, and customer balance", paidInvoicesWithBalance);
  add("HIGH", "credit_notes", "draft credit note has issued/void lifecycle timestamp", "Compare invoice history and audit events before any correction", draftCreditsWithLifecycleDates);
  add("HIGH", "payments", "payment has both sale and invoice allocation IDs", "Determine the intended receivable before changing allocations", multiplyAllocatedPayments);
  add("HIGH", "payments", "confirmed M-Pesa row lacks reconciliation timestamp or provider reference", "Verify against provider records; status alone is not payment evidence", unverifiedMpesa);
  add("INFO", "payments", "unallocated customer payment records", "Compare customer credit and gross receivables using the read-only reconciliation report", unallocatedPayments);
  add("HIGH", "invoices", "linked invoice has no sale in the same business", "Verify identity and business scope before restoring or unlinking", Number(orphanInvoices[0]?.records ?? 0));
  add("HIGH", "invoices", "linked invoice and source sale have different branch IDs", "Verify branch transfer history and access scope", Number(branchMismatchedInvoices[0]?.records ?? 0));
  add("HIGH", "payments", "reversal/refund row lacks a source payment ID", "Trace audit history before treating the signed amount as valid", untracedReversals);
  add("HIGH", "payments", "net posted allocation exceeds the source sale total", "Review source balance, linked invoice history, and reversal sequence", Number(overallocatedSales[0]?.records ?? 0));
  add("HIGH", "payments", "net posted allocation exceeds the source invoice total", "Review invoice history, credit/debit notes, and reversal sequence", Number(overallocatedInvoices[0]?.records ?? 0));
  const summary = Object.fromEntries((['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as Severity[]).map((severity) => [severity, findings.filter((item) => item.severity === severity).length]));
  console.log(JSON.stringify({ readOnly: true, generatedAt: new Date().toISOString(), summary, findings }, null, 2));
  await mongoose.disconnect();
}
main().catch(async (error) => { console.error(error instanceof Error ? error.message : error); await mongoose.disconnect().catch(() => undefined); process.exitCode = 1; });
