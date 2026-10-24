import "reflect-metadata";
import assert from "node:assert/strict";
import { ForbiddenException, BadRequestException } from "@nestjs/common";
import { StockTransfersService } from "../src/modules/stock-transfers/stock-transfers.service";

type Row = Record<string, any>;

class Query<T> {
  constructor(private readonly read: () => T) {}
  session() { return this; }
  select() { return this; }
  sort() { return this; }
  async lean() { return this.read(); }
  then(resolve: (value: T) => unknown, reject?: (reason: unknown) => unknown) { return Promise.resolve(this.read()).then(resolve, reject); }
}

function makeScenario(initialStock = 12) {
  const transfer: Row = {
    _id: "transfer-db-id",
    externalId: "transfer-external-1",
    businessId: "business-1",
    fromBranchId: "branch-a",
    toBranchId: "branch-b",
    transferNumber: "TR-1",
    status: "draft",
    transferDate: new Date("2026-10-21T00:00:00.000Z"),
    dispatchedAt: null,
    receivedAt: null,
    deletedAt: null,
    items: [{ productId: "catalog-product-1", quantity: 5, unitCost: 3.5, batchNumber: "BATCH-A", serialNumbers: ["SERIAL-1"] }]
  };
  const stock: Record<string, number> = { "branch-a": initialStock, "branch-b": 2 };
  const movements: Row[] = [];
  const matches = (row: Row, filter: Row) => Object.entries(filter).every(([key, value]) => {
    if (key === "deletedAt") return value === null ? row.deletedAt === null : true;
    if (key === "$and") return (value as Row[]).every((clause) => matches(row, clause));
    if (key === "$or") return (value as Row[]).some((clause) => matches(row, clause));
    if (key === "_id" || key === "externalId" || key === "businessId" || key === "status" || key === "dispatchedAt") return row[key] === value;
    return true;
  });
  const docForBranch = (branchId: string): Row | null => {
    if (!(branchId in stock)) return null;
    return {
      _id: `product-${branchId}`,
      externalId: "catalog-product-1",
      branchId,
      businessId: "business-1",
      name: "Widget",
      stockOnHand: stock[branchId],
      reservedQuantity: 1,
      isActive: true,
      deletedAt: null,
      async save() { stock[branchId] = this.stockOnHand; }
    };
  };
  const transferModel = {
    find(filter: Row) { return new Query(() => matches(transfer, filter) ? [{ _id: transfer._id }] : []); },
    findOne(filter: Row) { return new Query(() => matches(transfer, filter) ? { ...transfer } : null); },
    findOneAndUpdate(filter: Row, update: Row) {
      return new Query(() => {
        if (!matches(transfer, filter)) return null;
        if (update.$set) Object.assign(transfer, update.$set);
        else Object.assign(transfer, update);
        return { ...transfer };
      });
    }
  };
  const productModel = {
    findOne(filter: Row) {
      return new Query(() => {
        if (filter.businessId !== "business-1" || filter.externalId !== "catalog-product-1" || filter.deletedAt !== null || filter.isActive !== true) return null;
        return docForBranch(String(filter.branchId));
      });
    }
  };
  const movementModel = {
    async create(rows: Row[]) { movements.push(...rows.map((row) => ({ ...row }))); return rows; }
  };
  const branchModel = {
    find(filter: Row) {
      return new Query(() => filter.businessId === "business-1" ? [{ _id: "branch-a" }, { _id: "branch-b" }] : []);
    }
  };
  const connection = {
    async startSession() {
      return { withTransaction: async (work: () => Promise<unknown>) => work(), endSession: async () => undefined };
    }
  };
  return {
    service: new StockTransfersService(transferModel as any, productModel as any, movementModel as any, branchModel as any, connection as any),
    transfer,
    stock,
    movements
  };
}

async function main() {
  const scenario = makeScenario();
  const sourceManager = { role: "manager", branchId: "branch-a" };
  const destinationManager = { role: "manager", branchId: "branch-b" };
  const dispatched = await scenario.service.dispatch("business-1", "transfer-external-1", sourceManager);
  assert.equal(dispatched.status, "in_transit");
  assert.equal(scenario.stock["branch-a"], 7);
  assert.equal(scenario.movements.length, 1);
  assert.equal(scenario.movements[0]?.referenceType, "transfer");
  assert.equal(scenario.movements[0]?.quantityDelta, -5);
  assert.equal(scenario.movements[0]?.batchNumber, "BATCH-A");
  assert.deepEqual(scenario.movements[0]?.serialNumbers, ["SERIAL-1"]);
  await scenario.service.dispatch("business-1", "transfer-external-1", sourceManager);
  assert.equal(scenario.stock["branch-a"], 7, "dispatch replay must not deduct stock twice");
  assert.equal(scenario.movements.length, 1, "dispatch replay must not duplicate movement rows");

  const received = await scenario.service.receive("business-1", "transfer-external-1", destinationManager);
  assert.equal(received.status, "received");
  assert.equal(scenario.stock["branch-b"], 7);
  assert.equal(scenario.movements.length, 2);
  assert.equal(scenario.movements[1]?.quantityDelta, 5);
  assert.equal(scenario.movements[1]?.batchNumber, "BATCH-A");
  assert.deepEqual(scenario.movements[1]?.serialNumbers, ["SERIAL-1"]);
  await scenario.service.receive("business-1", "transfer-external-1", destinationManager);
  assert.equal(scenario.stock["branch-b"], 7, "receipt replay must not add stock twice");
  assert.equal(scenario.movements.length, 2, "receipt replay must not duplicate movement rows");

  const insufficient = makeScenario(4);
  await assert.rejects(() => insufficient.service.dispatch("business-1", "transfer-external-1", sourceManager), BadRequestException);
  assert.equal(insufficient.stock["branch-a"], 4);
  assert.equal(insufficient.movements.length, 0);

  const wrongBranch = makeScenario();
  await assert.rejects(() => wrongBranch.service.dispatch("business-1", "transfer-external-1", destinationManager), ForbiddenException);
  assert.equal(wrongBranch.stock["branch-a"], 12);

  const bypass = makeScenario();
  await assert.rejects(() => bypass.service.update("business-1", "transfer-external-1", { status: "received" } as any, sourceManager), BadRequestException);
  await bypass.service.dispatch("business-1", "transfer-external-1", sourceManager);
  await assert.rejects(() => bypass.service.archive("business-1", "transfer-external-1", sourceManager), BadRequestException);
  console.log("Stock-transfer inventory smoke checks passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
