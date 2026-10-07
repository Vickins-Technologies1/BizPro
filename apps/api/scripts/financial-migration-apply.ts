import mongoose from "mongoose";

async function main() {
  if (process.env.FINANCIAL_MIGRATION_CONFIRM !== "true") throw new Error("Refusing mutation. Set FINANCIAL_MIGRATION_CONFIRM=true explicitly.");
  if (process.env.FINANCIAL_MIGRATION_VERSION !== "financial-v1") throw new Error("Set FINANCIAL_MIGRATION_VERSION=financial-v1 explicitly.");
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri, process.env.MONGODB_DB ? { dbName: process.env.MONGODB_DB } : undefined);
  const db = mongoose.connection.db!;
  const checkpoint = await db.collection("financial_migration_checkpoints").findOne({ version: "financial-v1" });
  if (checkpoint?.completedAt) { console.log(JSON.stringify({ resumed: true, completedAt: checkpoint.completedAt })); await mongoose.disconnect(); return; }
  await db.collection("financial_migration_checkpoints").updateOne({ version: "financial-v1" }, { $set: { version: "financial-v1", startedAt: new Date(), mode: "currency-and-metadata-only" } }, { upsert: true });
  const businesses = await db.collection("businesses").find({}, { projection: { currency: 1 } }).toArray();
  let modified = 0;
  for (const business of businesses) {
    const result = await db.collection("sales").updateMany({ businessId: String(business._id), currency: { $exists: false } }, { $set: { currency: String(business.currency ?? "KES"), calculationVersion: 1 } });
    modified += result.modifiedCount;
  }
  await db.collection("financial_migration_checkpoints").updateOne({ version: "financial-v1" }, { $set: { completedAt: new Date(), modified, note: "No historical totals, prices, costs, duplicates, balances, or transactions were changed" } });
  console.log(JSON.stringify({ applied: true, modified, warning: "Only unambiguous currency/metadata backfill was attempted; all other findings remain for manual reconstruction" }, null, 2));
  await mongoose.disconnect();
}
main().catch(async (error) => { console.error(error instanceof Error ? error.message : error); await mongoose.disconnect().catch(() => undefined); process.exitCode = 1; });
