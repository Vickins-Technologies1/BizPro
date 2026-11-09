import mongoose from "mongoose";
import { calculateCustomerCredit, calculateCustomerOutstanding, reconcileCustomerBalance } from "../src/modules/customers/customer-balance";
import { eligiblePaymentMatch } from "../src/common/payment-integrity";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri, process.env.MONGODB_DB ? { dbName: process.env.MONGODB_DB } : undefined);
  const db = mongoose.connection.db!;
  const customers = await db.collection("customers").find({ deletedAt: null }).toArray();
  const report = [];
  for (const customer of customers) {
    const key = [String(customer._id), customer.externalId].filter(Boolean);
    const [sales, invoices, payments] = await Promise.all([
      db.collection("sales").find({ businessId: customer.businessId, customerId: { $in: key }, deletedAt: null }).project({ _id: 1, externalId: 1, balanceDue: 1, currency: 1 }).toArray(),
      db.collection("invoices").find({ businessId: customer.businessId, customerId: { $in: key }, deletedAt: null, status: { $nin: ["draft", "void", "cancelled", "archived"] } }).project({ _id: 1, externalId: 1, saleId: 1, balanceDue: 1, currency: 1 }).toArray(),
      db.collection("payments").find({ businessId: customer.businessId, customerId: { $in: key }, saleId: null, invoiceId: null, deletedAt: null, $and: [eligiblePaymentMatch()] }).project({ amount: 1 }).toArray()
    ]);
    const calculated = calculateCustomerOutstanding({ sales, invoices });
    const customerCredit = calculateCustomerCredit(payments);
    const result = reconcileCustomerBalance(Number(customer.balance ?? 0), calculated);
    report.push({ customerId: customer.externalId ?? String(customer._id), businessId: customer.businessId, branchId: customer.branchId ?? null, name: customer.name, customerCredit, ...result, status: Number(customer.balance ?? 0) < 0 ? "INVALID" : result.isMatch ? "MATCH" : "MISMATCH" });
  }
  const mismatches = report.filter((row) => row.status !== "MATCH");
  const customerCreditTotal = Number(report.reduce((sum, row) => sum + row.customerCredit, 0).toFixed(2));
  console.log(JSON.stringify({ readOnly: true, generatedAt: new Date().toISOString(), count: report.length, mismatchCount: mismatches.length, grossOutstandingTotal: Number(report.reduce((sum, row) => sum + row.calculatedBalance, 0).toFixed(2)), customerCreditTotal, report }, null, 2));
  await mongoose.disconnect();
}
main().catch(async (error) => { console.error(error instanceof Error ? error.message : error); await mongoose.disconnect().catch(() => undefined); process.exitCode = 1; });
