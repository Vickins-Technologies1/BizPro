import mongoose from "mongoose";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri, process.env.MONGODB_DB ? { dbName: process.env.MONGODB_DB } : undefined);
  const db = mongoose.connection.db!;
  const [missingCurrency, missingVersion, missingCost, duplicates] = await Promise.all([
    db.collection("sales").countDocuments({ currency: { $exists: false } }),
    db.collection("sales").countDocuments({ calculationVersion: { $exists: false } }),
    db.collection("sales").countDocuments({ "items.costPrice": { $exists: false } }),
    db.collection("sales").aggregate([{ $match: { externalId: { $type: "string", $ne: "" } } }, { $group: { _id: { businessId: "$businessId", externalId: "$externalId" }, ids: { $push: "$_id" }, count: { $sum: 1 }, amounts: { $push: "$grandTotal" }, statuses: { $push: "$paymentStatus" }, createdAt: { $push: "$createdAt" } } }, { $match: { count: { $gt: 1 } } }, { $limit: 100 }]).toArray()
  ]);
  const classifiedDuplicates = duplicates.map((group) => {
    const sameAmount = new Set((group.amounts ?? []).map((value: unknown) => Number(value ?? 0))).size === 1;
    const sameStatus = new Set(group.statuses ?? []).size === 1;
    const classification = sameAmount && sameStatus ? "OFFLINE_REPLAY" : "UNKNOWN";
    return { ...group, classification, resolution: classification === "OFFLINE_REPLAY" ? "MANUAL_REVIEW_REQUIRED_BEFORE_ANY_MERGE" : "MANUAL_REVIEW_REQUIRED" };
  });
  console.log(JSON.stringify({ readOnly: true, migrationVersion: "financial-v1", generatedAt: new Date().toISOString(), items: [
    { field: "currency", count: missingCurrency, classification: "SAFE_TO_BACKFILL_ONLY_WHEN_BUSINESS_POLICY_IS_UNAMBIGUOUS", action: "derive from business currency and preserve original record" },
    { field: "calculationVersion", count: missingVersion, classification: "SAFE_TO_BACKFILL_AS_METADATA_ONLY", action: "mark legacy; do not recalculate historical amounts" },
    { field: "items.costPrice", count: missingCost, classification: "CANNOT_BE_RECONSTRUCTED_WITHOUT_EVIDENCE", action: "leave historical cost unknown and flag reporting" },
    { field: "duplicate external IDs", count: classifiedDuplicates.length, classification: "REQUIRES_RECONSTRUCTION", action: "classify replay versus legitimate distinct record; never delete automatically", conflicts: classifiedDuplicates }
  ] }, null, 2));
  await mongoose.disconnect();
}
main().catch(async (error) => { console.error(error instanceof Error ? error.message : error); await mongoose.disconnect().catch(() => undefined); process.exitCode = 1; });
