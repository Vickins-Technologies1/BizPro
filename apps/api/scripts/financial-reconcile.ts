import mongoose from "mongoose";
import { calculateCustomerOutstanding, reconcileCustomerBalance } from "../src/modules/customers/customer-balance";

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
      db.collection("sales").find({ businessId: customer.businessId, customerId: { $in: key }, deletedAt: null }).project({ balanceDue: 1 }).toArray(),
      db.collection("invoices").find({ businessId: customer.businessId, customerId: { $in: key }, deletedAt: null }).project({ balanceDue: 1 }).toArray(),
      db.collection("payments").find({ businessId: customer.businessId, customerId: { $in: key }, saleId: null, invoiceId: null }).project({ amount: 1 }).toArray()
    ]);
    const calculated = calculateCustomerOutstanding({ sales, invoices, standalonePayments: payments });
    const result = reconcileCustomerBalance(Number(customer.balance ?? 0), calculated);
    report.push({ customerId: customer.externalId ?? String(customer._id), businessId: customer.businessId, name: customer.name, ...result, status: Number(customer.balance ?? 0) < 0 ? "INVALID" : result.isMatch ? "MATCH" : "MISMATCH" });
  }
  console.log(JSON.stringify({ readOnly: true, generatedAt: new Date().toISOString(), count: report.length, report }, null, 2));
  await mongoose.disconnect();
}
main().catch(async (error) => { console.error(error instanceof Error ? error.message : error); await mongoose.disconnect().catch(() => undefined); process.exitCode = 1; });
