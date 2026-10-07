import mongoose from "mongoose";

async function main() {
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error("MONGODB_TEST_URI is required; refusing to run concurrency tests against an unspecified database");
  await mongoose.connect(uri);
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName) throw new Error("Concurrency tests require a MongoDB replica set; no production or standalone database will be used");
  console.log(JSON.stringify({ available: true, replicaSet: hello.setName, status: "HARNESS_AVAILABLE_BUT_SCENARIOS_REQUIRE_SEEDED_TEST_FIXTURES", scenarios: ["concurrent-inventory-sale", "duplicate-sale", "duplicate-payment", "concurrent-credit-note", "transaction-rollback", "sync-replay"] }, null, 2));
  await mongoose.disconnect();
}
main().catch(async (error) => { console.error(error instanceof Error ? error.message : error); await mongoose.disconnect().catch(() => undefined); process.exitCode = 1; });
