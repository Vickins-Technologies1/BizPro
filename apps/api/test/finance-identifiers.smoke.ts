import "reflect-metadata";
import assert from "node:assert/strict";

type QueryCall = { filter: Record<string, unknown>; update: Record<string, unknown> };

async function main() {
  const calls: Record<string, QueryCall[]> = { bank: [], petty: [], credit: [] };
  const creditFinds: Record<string, unknown>[] = [];
  const model = (kind: "bank" | "petty" | "credit") => ({
    findOneAndUpdate(filter: Record<string, unknown>, update: Record<string, unknown>) {
      calls[kind].push({ filter, update });
      const externalId = (filter.$or as Array<Record<string, string>> | undefined)?.find((item) => item.externalId)?.externalId ?? "finance-record";
      return { lean: async () => ({ _id: "65e000000000000000000001", externalId, businessId: filter.businessId, deletedAt: new Date(), status: "void" }) };
    }
  });
  const creditModel = {
    ...model("credit"),
    findOne(filter: Record<string, unknown>) {
      creditFinds.push(filter);
      return Promise.resolve({ _id: "65e000000000000000000001", externalId: "credit-external-1", businessId: filter.businessId, status: "draft", creditDate: new Date(), save: async () => undefined, toObject() { return { ...this }; } });
    }
  };
  const { FinanceService } = require("../src/modules/finance/finance.service") as { FinanceService: new (...dependencies: unknown[]) => Record<string, (...args: any[]) => Promise<unknown>> };
  const service = new FinanceService({}, {}, {}, {}, model("bank"), model("petty"), creditModel, {}, {}, {});

  await service.archiveBankAccount("business-1", "bank-external-1");
  await service.archivePettyCashEntry("business-1", "petty-external-1");
  await service.archiveCreditNote("business-1", "credit-external-1");

  assert.equal(calls.bank[0]?.filter.externalId, "bank-external-1");
  assert.equal(calls.petty[0]?.filter.externalId, "petty-external-1");
  assert.equal(creditFinds[0]?.externalId, "credit-external-1");
  for (const key of ["bank", "petty"] as const) assert.equal(calls[key][0]?.filter.businessId, "business-1");
  assert.equal(creditFinds[0]?.businessId, "business-1");

  const objectId = "65e000000000000000000001";
  await service.archiveBankAccount("business-1", objectId);
  assert.deepEqual(calls.bank[1]?.filter.$or, [{ _id: objectId }, { externalId: objectId }]);
  console.log("Finance external-ID lookup smoke checks passed.");
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
