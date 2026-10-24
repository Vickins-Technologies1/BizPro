import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PurchaseOrdersService } from "../src/modules/purchase-orders/purchase-orders.service";

function fakeQuery<T>(read: () => T) {
  const query: any = {
    session: () => query,
    lean: () => query,
    sort: () => query,
    then: (resolve: (value: T) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve().then(read).then(resolve, reject)
  };
  return query;
}

function matchesOrder(order: any, filter: any) {
  if (!order || order.businessId !== filter.businessId || order.deletedAt !== null) return false;
  const identity = filter.$and?.[0] ?? {};
  const identityMatches = identity.externalId ? order.externalId === identity.externalId : identity.$or?.some((entry: any) => entry.externalId === order.externalId || String(order._id) === entry._id);
  const branch = filter.$and?.[1];
  const branchMatches = !branch?.$or || branch.$or.some((entry: any) => entry.branchId === order.branchId);
  return Boolean(identityMatches && branchMatches);
}

function makeOrder(externalId: string, quantity: number) {
  return {
    _id: externalId,
    externalId,
    businessId: "business-1",
    branchId: "branch-1",
    orderNumber: externalId.toUpperCase(),
    status: "ordered",
    deletedAt: null,
    receipts: [] as Array<{ receiptId: string; items: Array<{ productId: string; quantity: number }> }>,
    items: [{ productId: "product-1", productName: "Coffee", quantity, receivedQuantity: 0, unitCost: 3 }]
  };
}

async function run() {
  const ordersById = new Map([["po-1", makeOrder("po-1", 10)], ["po-2", makeOrder("po-2", 3)]]);
  const product = {
    _id: "product-internal-1",
    externalId: "product-1",
    businessId: "business-1",
    branchId: "branch-1",
    stockOnHand: 0,
    save: async () => undefined
  };
  const movements: any[] = [];
  const ordersModel = {
    findOne: (filter: any) => fakeQuery(() => [...ordersById.values()].find((order) => matchesOrder(order, filter)) ?? null),
    findOneAndUpdate: (filter: any, update: any) => fakeQuery(() => {
      const order = [...ordersById.values()].find((candidate) => matchesOrder(candidate, filter));
      if (!order) return null;
      Object.assign(order, update.$set ?? {});
      if (update.$push?.receipts) order.receipts.push(update.$push.receipts);
      return order;
    })
  };
  const productModel = { findOne: () => fakeQuery(() => product) };
  const movementModel = { create: async (items: any[]) => { movements.push(...items); return items; } };
  const businessModel = { findOne: () => fakeQuery(() => ({ businessId: "business-1", businessType: "retail_shop" })) };
  const session: any = { withTransaction: async (work: () => Promise<unknown>) => work(), endSession: async () => undefined };
  const connection = { startSession: async () => session };
  const service = new PurchaseOrdersService(ordersModel as never, productModel as never, movementModel as never, businessModel as never, connection as never);
  const ownerBranch = { role: "owner", branchId: null, requestedBranchId: "branch-1" };

  const partial = await service.receive("business-1", "po-1", { receiptId: "receipt-0001", items: [{ productId: "product-1", quantity: 4 }] }, ownerBranch);
  assert.equal(partial.status, "partially_received");
  assert.equal(partial.items[0]?.receivedQuantity, 4);
  assert.equal(product.stockOnHand, 4);
  assert.equal(movements.length, 1);

  const repeated = await service.receive("business-1", "po-1", { receiptId: "receipt-0001", items: [{ productId: "product-1", quantity: 4 }] }, ownerBranch);
  assert.equal(repeated.items[0]?.receivedQuantity, 4);
  assert.equal(product.stockOnHand, 4, "repeating a receipt ID must not add stock twice");
  assert.equal(movements.length, 1);

  const complete = await service.receive("business-1", "po-1", { receiptId: "receipt-0002", items: [{ productId: "product-1", quantity: 6 }] }, ownerBranch);
  assert.equal(complete.status, "received");
  assert.equal(complete.items[0]?.receivedQuantity, 10);
  assert.ok(complete.receivedAt);
  assert.equal(product.stockOnHand, 10);
  assert.equal(movements.length, 2);

  await assert.rejects(
    service.receive("business-1", "po-1", { receiptId: "receipt-0003", items: [{ productId: "product-1", quantity: 1 }] }, ownerBranch),
    BadRequestException
  );
  await assert.rejects(
    service.receive("business-1", "po-2", { receiptId: "receipt-0004", items: [{ productId: "product-1", quantity: 3.01 }] }, ownerBranch),
    BadRequestException
  );
  assert.equal(product.stockOnHand, 10, "an over-receipt must not mutate product stock");
  assert.equal(movements.length, 2);

  await assert.rejects(
    service.receive("business-1", "po-1", { receiptId: "receipt-0005", items: [{ productId: "product-1", quantity: 1 }] }, { ...ownerBranch, requestedBranchId: "branch-2" }),
    NotFoundException
  );
  await assert.rejects(service.update("business-1", "po-1", { status: "received" }, ownerBranch), BadRequestException);
  await assert.rejects(service.archive("business-1", "po-1", ownerBranch), BadRequestException);

  console.log("Purchase-order receipt smoke checks passed.");
}

void run();
