import mongoose from "mongoose";

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
  const [salesDup, paymentsDup, expensesDup, creditsDup, badSales, missingSnapshots, badQty, badExpenses, badPayments, badCredits, negativeStock, pendingSync, negativeCustomers, negativeBank, pettyDup] = await Promise.all([
    duplicates("sales"), duplicates("payments"), duplicates("expenses"), duplicates("credit_notes"),
    count("sales", { ...active, $or: [{ grandTotal: { $lt: 0 } }, { balanceDue: { $lt: 0 } }, { amountPaid: { $lt: 0 } }] }),
    count("sales", { ...active, $or: [{ currency: { $exists: false } }, { calculationVersion: { $exists: false } }, { "items.unitPrice": { $exists: false } }, { "items.costPrice": { $exists: false } }] }),
    count("sales", { ...active, "items.quantity": { $lte: 0 } }),
    count("expenses", { ...active, $or: [{ amount: { $lt: 0 } }, { amount: { $not: { $type: "number" } } }] }),
    count("payments", { $or: [{ amount: { $lt: 0 } }, { amount: 0 }] }),
    count("credit_notes", { ...active, $or: [{ amount: { $lte: 0 } }, { amount: { $not: { $type: "number" } } }] }),
    count("products", { ...active, stockOnHand: { $lt: 0 } }), count("sync_events", { status: { $in: ["pending", "failed"] } }),
    count("customers", { ...active, balance: { $lt: 0 } }), count("bank_accounts", { ...active, currentBalance: { $lt: 0 } }), duplicates("petty_cash_entries")
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
  const summary = Object.fromEntries((['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as Severity[]).map((severity) => [severity, findings.filter((item) => item.severity === severity).length]));
  console.log(JSON.stringify({ readOnly: true, generatedAt: new Date().toISOString(), summary, findings }, null, 2));
  await mongoose.disconnect();
}
main().catch(async (error) => { console.error(error instanceof Error ? error.message : error); await mongoose.disconnect().catch(() => undefined); process.exitCode = 1; });
