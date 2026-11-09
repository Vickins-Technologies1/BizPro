import "reflect-metadata";
import assert from "node:assert/strict";

type CallRecord = {
  method: string;
  query?: unknown;
  update?: unknown;
  options?: unknown;
  input?: unknown;
};

function leanResult<T>(value: T) {
  return {
    lean: async () => value
  };
}

function createDoc<T extends Record<string, unknown>>(value: T) {
  const doc: Record<string, unknown> = { ...value };
  doc.save = async () => undefined;
  doc.toObject = () => {
    const { save, toObject, ...rest } = doc;
    return { ...rest };
  };
  return doc;
}

async function main() {
  const { BusinessesService, CustomersService, InvoicesController, JwtStrategy, ProductsService, PurchaseOrdersService, SalesService, StockTransfersService } = loadServices();
  await testProductsService(ProductsService);
  await testCustomersService(CustomersService);
  await testCustomersListWithInvalidAttachmentDate(CustomersService);
  await testBusinessesService(BusinessesService);
  await testJwtStrategyBusinessLookup(JwtStrategy);
  await testSalesService(SalesService);
  await testSalesServiceInvalidProductId(SalesService);
  await testInvoicePaymentBranchQuery(InvoicesController);
  await testInvoiceFinancialValidation();
  await testPurchaseOrderIdentityAndBranch(PurchaseOrdersService);
  await testStockTransferIdentity(StockTransfersService);
  console.log("Tenant safety smoke checks passed.");
}

async function testInvoiceFinancialValidation() {
  const { InvoicesService } = require("../src/modules/invoices/invoices.service") as { InvoicesService: new (...args: any[]) => any };
  const service = new InvoicesService(...Array.from({ length: 11 }, () => ({})));
  const calculate = (input: Record<string, unknown>) => (service as any).calculateLineItem({
    description: "Test line",
    quantity: 1,
    unit: "pcs",
    unitPrice: 100,
    discountType: "fixed",
    discountValue: 0,
    taxCategory: "vat",
    taxRate: 16,
    taxInclusive: false,
    ...input
  });
  const line = calculate({});
  assert.equal(line.lineSubtotal, 100);
  assert.equal(line.lineTotal, 116);
  assert.throws(() => calculate({ quantity: 0 }), /quantity/i);
  assert.throws(() => calculate({ quantity: -1 }), /quantity/i);
  assert.throws(() => calculate({ unitPrice: -1 }), /unit price/i);
  assert.throws(() => calculate({ discountValue: 100.01, discountType: "percentage" }), /percentage/i);
  assert.throws(() => calculate({ discountValue: 100.01 }), /discount/i);
  assert.throws(() => calculate({ taxRate: 1001 }), /tax rate/i);

  const prepare = (amountPaid: number) => (service as any).prepareInvoicePayload({
    businessId: "business-1",
    issueDate: new Date(),
    dueDate: new Date(),
    paymentTerms: "Due now",
    currency: "KES",
    lineItems: [{ description: "Test line", quantity: 1, unit: "pcs", unitPrice: 100, taxCategory: "exempt", taxRate: 0 }],
    amountPaid
  });
  assert.equal(prepare(100).record.balanceDue, 0);
  assert.throws(() => prepare(-1), /amountPaid/i);
  assert.throws(() => prepare(100.01), /amountPaid/i);
}

function loadServices() {
  const moduleLoader = require("module") as typeof import("module");
  const originalLoad = moduleLoader._load;
  const mongooseModule = require("@nestjs/mongoose");

  moduleLoader._load = function patchedLoad(request: string, parent: NodeModule | null, isMain: boolean) {
    if (request === "@nestjs/mongoose") {
      return {
        ...mongooseModule,
        Prop: () => () => undefined
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  return {
    BusinessesService: require("../src/modules/businesses/businesses.service").BusinessesService as any,
    ProductsService: require("../src/modules/products/products.service").ProductsService as any,
    CustomersService: require("../src/modules/customers/customers.service").CustomersService as any,
    SalesService: require("../src/modules/sales/sales.service").SalesService as any,
    PurchaseOrdersService: require("../src/modules/purchase-orders/purchase-orders.service").PurchaseOrdersService as any,
    StockTransfersService: require("../src/modules/stock-transfers/stock-transfers.service").StockTransfersService as any,
    InvoicesController: require("../src/modules/invoices/invoices.controller").InvoicesController as any,
    JwtStrategy: require("../src/modules/auth/jwt.strategy").JwtStrategy as any
  };
}

async function testStockTransferIdentity(StockTransfersService: any) {
  const calls: CallRecord[] = [];
  const current = { status: "draft", fromBranchId: "branch-1", toBranchId: "branch-2" };
  const stockTransferModel = {
    findOne(query: Record<string, unknown>) {
      calls.push({ method: "stockTransfer.findOne", query });
      return leanResult(current);
    },
    findOneAndUpdate(query: Record<string, unknown>, update: Record<string, unknown>, options: Record<string, unknown>) {
      calls.push({ method: "stockTransfer.findOneAndUpdate", query, update, options });
      return leanResult({ id: "transfer-1", ...update });
    }
  };
  const service = new StockTransfersService(stockTransferModel as any, {} as any, {} as any, {} as any, {} as any);
  await service.update("business-1", "transfer-external-1", { businessId: "ignored", note: "updated" } as any, { role: "manager", branchId: "branch-1" });
  const identityFilter = { businessId: "business-1", deletedAt: null, $and: [{ externalId: "transfer-external-1" }] };
  assert.deepEqual(calls[0], { method: "stockTransfer.findOne", query: identityFilter });
  assert.deepEqual(calls[1], {
    method: "stockTransfer.findOneAndUpdate",
    query: { ...identityFilter, status: "draft" },
    update: { note: "updated", fromBranchId: "branch-1", toBranchId: "branch-2" },
    options: { new: true }
  });
  calls.length = 0;
  await service.archive("business-1", "transfer-external-1", { role: "owner" });
  assert.deepEqual(calls[0]?.query, identityFilter);
  assert.deepEqual(calls[1]?.query, { ...identityFilter, status: "draft" });
}

async function testPurchaseOrderIdentityAndBranch(PurchaseOrdersService: any) {
  const calls: CallRecord[] = [];
  const purchaseOrderModel = {
    findOne(query: Record<string, unknown>) {
      calls.push({ method: "purchaseOrder.findOne", query });
      return leanResult({ status: "ordered", items: [], receipts: [] });
    },
    findOneAndUpdate(query: Record<string, unknown>, update: Record<string, unknown>, options: Record<string, unknown>) {
      calls.push({ method: "purchaseOrder.findOneAndUpdate", query, update, options });
      return leanResult({ id: "purchase-1", ...update });
    }
  };
  const service = new PurchaseOrdersService(purchaseOrderModel as any);
  await service.update("business-1", "po-external-1", { branchId: "branch-2", notes: "Updated", businessId: "ignored" } as any, { role: "cashier", branchId: "branch-1" });
  const purchaseOrderQuery = {
    businessId: "business-1",
    deletedAt: null,
    $and: [
      { externalId: "po-external-1" },
      { $or: [{ branchId: "branch-1" }, { branchId: null }] }
    ]
  };
  assert.deepEqual(calls[0], { method: "purchaseOrder.findOne", query: purchaseOrderQuery });
  assert.deepEqual(calls[1], {
    method: "purchaseOrder.findOneAndUpdate",
    query: purchaseOrderQuery,
    update: { notes: "Updated" },
    options: { new: true }
  });
  calls.length = 0;
  await service.archive("business-1", "po-external-1", { role: "owner", branchId: null, requestedBranchId: "branch-2" });
  const archivedQuery = calls[0]?.query as Record<string, unknown>;
  assert.equal(archivedQuery.businessId, "business-1");
  assert.deepEqual(archivedQuery.$and, [
    { externalId: "po-external-1" },
    { $or: [{ branchId: "branch-2" }, { branchId: null }] }
  ]);
  assert.deepEqual(calls[1]?.query, archivedQuery);
}

async function testInvoicePaymentBranchQuery(InvoicesController: any) {
  let received: { input?: Record<string, unknown>; scope?: Record<string, unknown> } | null = null;
  const controller = new InvoicesController({
    async recordPayment(input: Record<string, unknown>, scope: Record<string, unknown>) {
      received = { input, scope };
      return { ok: true };
    }
  });
  await controller.recordPayment(
    { businessId: "business-1", sub: "user-1", role: "owner", branchId: null },
    "invoice-1",
    { amount: 20, method: "cash", paymentDate: "2026-10-19", reference: "receipt-1" },
    "branch-2"
  );
  assert.deepEqual(received, {
    input: {
      businessId: "business-1",
      invoiceId: "invoice-1",
      amount: 20,
      method: "cash",
      paymentDate: new Date("2026-10-19"),
      reference: "receipt-1",
      note: null,
      externalId: null,
      recordedById: "user-1"
    },
    scope: { role: "owner", branchId: null, requestedBranchId: "branch-2" }
  });
}

async function testProductsService(ProductsService: any) {
  const calls: CallRecord[] = [];
  const productId = "64b3e9f0d8e4c5a123456789";
  const productDoc = createDoc({
    _id: productId,
    businessId: "business-1",
    stockOnHand: 10,
    deletedAt: null
  });

  const updatedProduct = {
    _id: productId,
    businessId: "business-1",
    name: "Updated",
    deletedAt: null
  };

  const productModel = {
    findOneAndUpdate(query: Record<string, unknown>, update: Record<string, unknown>, options: Record<string, unknown>) {
      calls.push({ method: "findOneAndUpdate", query, update, options });
      return leanResult(updatedProduct);
    },
    findOne(query: Record<string, unknown>) {
      calls.push({ method: "findOne", query });
      return Promise.resolve(productDoc);
    }
  };

  const movementModel = {
    findOne(query: Record<string, unknown>) {
      calls.push({ method: "movement.findOne", query });
      return leanResult(null);
    },
    create(input: Record<string, unknown>) {
      calls.push({ method: "movement.create", input });
      return Promise.resolve({ ...input });
    }
  };

  const saleModel = {
    aggregate() {
      return Promise.resolve([]);
    }
  };

  const service = new ProductsService(productModel as any, movementModel as any, saleModel as any);

  const updated = await service.update("business-1", productId, { businessId: "other-business", name: "Updated" });
  assert.equal(updated.name, "Updated");
  assert.deepEqual(calls[0], {
    method: "findOneAndUpdate",
    query: {
      businessId: "business-1",
      deletedAt: null,
      $or: [{ _id: productId }, { externalId: productId }]
    },
    update: { name: "Updated" },
    options: { new: true }
  });

  calls.length = 0;
  const archived = await service.archive("business-1", productId);
  assert.equal(archived.deletedAt instanceof Date || archived.deletedAt === undefined || archived.deletedAt === null, true);
  assert.equal(calls[0].method, "findOneAndUpdate");
  assert.deepEqual(calls[0].query, {
    businessId: "business-1",
    deletedAt: null,
    $or: [{ _id: productId }, { externalId: productId }]
  });
  assert.equal((calls[0].update as Record<string, unknown>).isActive, false);
  assert.ok((calls[0].update as Record<string, unknown>).deletedAt instanceof Date);
  assert.deepEqual(calls[0].options, { new: true });

  calls.length = 0;
  await service.adjustStock({
    businessId: "business-1",
    productId,
    referenceType: "adjustment",
    referenceId: "movement-1",
    quantityDelta: -2,
    unitCost: 100,
    note: "Adjustment"
  });

  assert.deepEqual(calls[0], {
    method: "findOne",
    query: {
      businessId: "business-1",
      deletedAt: null,
      $or: [{ _id: productId }, { externalId: productId }]
    }
  });
  assert.deepEqual(calls[1], {
    method: "movement.findOne",
    query: {
      businessId: "business-1",
      productId: { $in: [productId] },
      referenceType: "adjustment",
      referenceId: "movement-1"
    }
  });
  assert.deepEqual(calls[2], {
    method: "movement.create",
    input: {
      businessId: "business-1",
      branchId: null,
      productId,
      referenceType: "adjustment",
      referenceId: "movement-1",
      quantityDelta: -2,
      unitCost: 100,
      note: "Adjustment",
      externalId: "movement-1"
    }
  });
}

async function testCustomersService(CustomersService: any) {
  const calls: CallRecord[] = [];
  const customerDoc = createDoc({
    _id: "customer-1",
    businessId: "business-1",
    balance: 120
  });

  const customerModel = {
    findOne(query: Record<string, unknown>) {
      calls.push({ method: "findOne", query });
      return {
        session() {
          return customerDoc;
        }
      };
    }
  };

  const paymentModel = {
    findOne() {
      return { session() { return this; }, lean: async () => null };
    },
    create(input: Record<string, unknown>) {
      const payload = Array.isArray(input) ? input[0] ?? {} : input;
      calls.push({ method: "payment.create", input: payload });
      return Promise.resolve([
        {
        ...payload,
        toObject: () => ({ ...payload })
        }
      ]);
    },
    find() {
      return {
        sort() {
          return this;
        },
        limit() {
          return this;
        },
        lean: async () => []
      };
    }
  };

  const connection = {
    async startSession() {
      return {
        async withTransaction(work: () => Promise<void>) {
          await work();
        },
        async endSession() {
          return undefined;
        }
      };
    }
  };

  const customerGroupModel = {};
  const service = new CustomersService(customerModel as any, customerGroupModel as any, paymentModel as any, connection as any);

  const updatedCustomer = await service.addBalance("business-1", "customer-1", -30);
  assert.equal(updatedCustomer.balance, 90);
  assert.deepEqual(calls[0], {
    method: "findOne",
    query: {
      businessId: "business-1",
      deletedAt: null,
      $or: [{ _id: "customer-1" }, { externalId: "customer-1" }]
    }
  });

  calls.length = 0;
  await service.recordPayment({
    businessId: "business-1",
    customerId: "customer-1",
    externalId: "debt-payment-1",
    amount: 25,
    method: "cash",
    reference: "ref-1",
    note: "Debt payment",
    recordedById: "user-1"
  });

  assert.deepEqual(calls[0], {
    method: "findOne",
    query: {
      businessId: "business-1",
      deletedAt: null,
      $or: [{ _id: "customer-1" }, { externalId: "customer-1" }]
    }
  });
  assert.equal(calls[1]?.method, "payment.create");
  assert.equal((calls[1]?.input as Record<string, unknown> | undefined)?.businessId, "business-1");
  assert.equal((calls[1]?.input as Record<string, unknown> | undefined)?.branchId, null);

  calls.length = 0;
  await service.recordPayment({
    businessId: "business-1",
    customerId: "customer-1",
    branchId: "branch-2",
    externalId: "owner-payment-1",
    amount: 10,
    method: "cash"
  }, { role: "owner", branchId: null });
  assert.equal((calls.find((call) => call.method === "payment.create")?.input as Record<string, unknown> | undefined)?.branchId, "branch-2");

  calls.length = 0;
  await service.recordPayment({
    businessId: "business-1",
    customerId: "customer-1",
    branchId: "branch-2",
    externalId: "staff-payment-1",
    amount: 10,
    method: "cash"
  }, { role: "cashier", branchId: "branch-1" });
  assert.equal((calls.find((call) => call.method === "payment.create")?.input as Record<string, unknown> | undefined)?.branchId, "branch-1");

  calls.length = 0;
  await assert.rejects(() => service.recordPayment({
    businessId: "business-1",
    customerId: "customer-1",
    externalId: "invalid-payment-negative",
    amount: -1,
    method: "cash"
  }), /at least/);
  await service.recordPayment({
    businessId: "business-1",
    customerId: "customer-1",
    externalId: "advance-payment-over-balance",
    amount: 76,
    method: "cash"
  });
  assert.equal(calls.some((call) => call.method === "payment.create"), true, "advance payments may exceed outstanding debt and remain unapplied customer credit");
  assert.equal((calls.find((call) => call.method === "payment.create")?.input as Record<string, unknown> | undefined)?.amount, 76);
  assert.equal(customerDoc.balance, 90, "recording an unallocated advance does not change gross receivables");
}

async function testCustomersListWithInvalidAttachmentDate(CustomersService: any) {
  const customerModel = {
    find() {
      return {
        sort() {
          return this;
        },
        lean: async () => [
          {
            _id: "customer-1",
            businessId: "business-1",
            name: "Faulty attachment",
            attachments: [
              {
                id: "attachment-1",
                label: "Receipt",
                url: "https://example.com/receipt.pdf",
                addedAt: "not-a-real-date"
              }
            ]
          }
        ]
      };
    }
  };

  const customerGroupModel = {};
  const paymentModel = {};
  const connection = {
    async startSession() {
      return {
        async withTransaction(work: () => Promise<void>) {
          await work();
        },
        async endSession() {
          return undefined;
        }
      };
    }
  };

  const service = new CustomersService(customerModel as any, customerGroupModel as any, paymentModel as any, connection as any);
  const customers = await service.list("business-1", {});

  assert.equal(customers.length, 1);
  assert.equal(customers[0]?.attachments?.length, 1);
  assert.equal(typeof customers[0]?.attachments?.[0]?.addedAt, "string");
  assert.match(String(customers[0]?.attachments?.[0]?.addedAt), /^\d{4}-\d{2}-\d{2}T/);
}

async function testBusinessesService(BusinessesService: any) {
  const calls: CallRecord[] = [];
  const businessDoc = {
    _id: "db-business-id",
    externalId: "JBs-VOAjsYEjB9bb",
    name: "Dira OS",
    slug: "biz-pro",
    businessType: "retail",
    currency: "KES",
    planTier: "lite",
    billingStatus: "trial"
  };

  const businessModel = {
    findOne(query: Record<string, unknown>) {
      calls.push({ method: "business.findOne", query });
      return leanResult(businessDoc);
    },
    findOneAndUpdate(query: Record<string, unknown>, update: Record<string, unknown>, options: Record<string, unknown>) {
      calls.push({ method: "business.findOneAndUpdate", query, update, options });
      return leanResult({ ...businessDoc, ...update });
    }
  };

  const branchModel = {
    find(query: Record<string, unknown>) {
      calls.push({ method: "branch.find", query });
      return leanResult([
        {
          _id: "branch-1",
          businessId: "JBs-VOAjsYEjB9bb",
          deletedAt: null
        }
      ]);
    }
  };

  const service = new BusinessesService(businessModel as any, branchModel as any);

  const result = await service.get("JBs-VOAjsYEjB9bb");
  assert.equal(result.business.externalId, "JBs-VOAjsYEjB9bb");
  assert.deepEqual(calls[0], {
    method: "business.findOne",
    query: {
      deletedAt: null,
      $or: [{ externalId: "JBs-VOAjsYEjB9bb" }]
    }
  });
  assert.deepEqual(calls[1], {
    method: "branch.find",
    query: {
      businessId: "JBs-VOAjsYEjB9bb",
      deletedAt: null
    }
  });

  calls.length = 0;
  await service.update("JBs-VOAjsYEjB9bb", { name: "Dira OS Updated" });
  assert.deepEqual(calls[0], {
    method: "business.findOneAndUpdate",
    query: {
      deletedAt: null,
      $or: [{ externalId: "JBs-VOAjsYEjB9bb" }]
    },
    update: { name: "Dira OS Updated" },
    options: { new: true }
  });
}

async function testJwtStrategyBusinessLookup(JwtStrategy: any) {
  const calls: CallRecord[] = [];
  const userDoc = {
    _id: "64b3e9f0d8e4c5a123456789",
    businessId: "JBs-VOAjsYEjB9bb",
    isActive: true,
    role: "owner",
    fullName: "Owner User",
    branchId: null,
    ownerId: null,
    roleLabel: "Owner",
    permissions: []
  };
  const businessDoc = {
    _id: "db-business-id",
    externalId: "JBs-VOAjsYEjB9bb",
    name: "Dira OS",
    slug: "biz-pro",
    businessType: "retail",
    currency: "KES",
    planTier: "lite",
    billingStatus: "trial"
  };

  const userModel = {
    findOne(query: Record<string, unknown>) {
      calls.push({ method: "user.findOne", query });
      return leanResult(userDoc);
    }
  };

  const businessModel = {
    findOne(query: Record<string, unknown>) {
      calls.push({ method: "business.findOne", query });
      return leanResult(businessDoc);
    }
  };

  const strategy = new JwtStrategy({ get: () => "secret", getOrThrow: () => "secret" } as any, userModel as any, businessModel as any);
  const result = await strategy.validate({
    sub: "64b3e9f0d8e4c5a123456789",
    businessId: "JBs-VOAjsYEjB9bb",
    branchId: null,
    role: "owner",
    fullName: "Owner User"
  });

  assert.equal(result.businessId, "JBs-VOAjsYEjB9bb");
  assert.deepEqual(calls[0], {
    method: "user.findOne",
    query: {
      _id: "64b3e9f0d8e4c5a123456789",
      businessId: "JBs-VOAjsYEjB9bb",
      deletedAt: null
    }
  });
  assert.deepEqual(calls[1], {
    method: "business.findOne",
    query: {
      deletedAt: null,
      $or: [{ externalId: "JBs-VOAjsYEjB9bb" }]
    }
  });
}

async function testSalesService(SalesService: any) {
  const calls: CallRecord[] = [];
  const productDoc = createDoc({
    _id: "64b3e9f0d8e4c5a123456789",
    externalId: "QnV7IFpJ6tXuU_wB",
    businessId: "business-1",
    name: "Tea",
    sellingPrice: 50,
    buyingPrice: 20,
    stockOnHand: 10,
    lowStockThreshold: 5
  });
  const customerDoc = createDoc({
    _id: "customer-1",
    externalId: "customer-external-1",
    businessId: "business-1",
    balance: 40
  });
  let existingSale: Record<string, unknown> | null = null;

  const saleModel = {
    findOne(query: Record<string, unknown>) {
      return leanResult(existingSale && query.externalId === existingSale.externalId ? existingSale : null);
    },
    create(input: Record<string, unknown>) {
      const payload = Array.isArray(input) ? input[0] ?? {} : input;
      calls.push({ method: "sale.create", input: payload });
      existingSale = { _id: "sale-1", ...payload };
      return Promise.resolve([
        {
          _id: "sale-1",
          toObject: () => ({ _id: "sale-1", ...payload })
        }
      ]);
    }
  };

  const paymentModel = {
    create(input: Record<string, unknown>) {
      const payloads = Array.isArray(input) ? input : [input];
      calls.push({ method: "payment.create", input: payloads });
      return Promise.resolve(payloads.map((payload) => ({ ...payload, toObject: () => ({ ...payload }) })));
    }
  };

  const movementModel = {
    create(input: Record<string, unknown>) {
      const payload = Array.isArray(input) ? input[0] ?? {} : input;
      calls.push({ method: "movement.create", input: payload });
      return Promise.resolve({ ...payload });
    }
  };

  const productModel = {
    findOne(query: Record<string, unknown>) {
      calls.push({ method: "product.findOne", query });
      return {
        session() {
          return productDoc;
        }
      };
    }
    ,findOneAndUpdate() {
      calls.push({ method: "product.findOneAndUpdate" });
      return leanResult({ ...productDoc, stockOnHand: 8 });
    }
  };

  const customerModel = {
    findOne(query: Record<string, unknown>) {
      calls.push({ method: "customer.findOne", query });
      return {
        session() {
          return customerDoc;
        }
      };
    }
  };

  const connection = {
    async startSession() {
      return {
        async withTransaction(work: () => Promise<void>) {
          await work();
        },
        async endSession() {
          return undefined;
        }
      };
    }
  };

  const service = new SalesService(saleModel as any, paymentModel as any, movementModel as any, productModel as any, customerModel as any, connection as any);

  await service.create({
    businessId: "business-1",
    externalId: "sale-external-1",
    customerId: "customer-external-1",
    receiptNumber: "R-001",
    amountPaid: 95,
    paymentStatus: "partial",
    paymentMethod: "cash",
    paymentLines: [
      { method: "cash", amount: 45 },
      { method: "mpesa", amount: 50, reference: "MPESA-123" }
    ],
    notes: null,
    items: [
      {
        productId: "QnV7IFpJ6tXuU_wB",
        quantity: 2,
        discount: 0
      }
    ]
  });

  assert.deepEqual(calls[0], {
    method: "product.findOne",
    query: {
      businessId: "business-1",
      deletedAt: null,
      $or: [{ externalId: "QnV7IFpJ6tXuU_wB" }]
    }
  });
  const saleCreate = calls.find((call) => call.method === "sale.create")?.input as Record<string, unknown>;
  assert.equal(saleCreate.grandTotal, 100);
  assert.equal(saleCreate.amountPaid, 45);
  assert.equal(saleCreate.balanceDue, 55);
  const saleItem = (saleCreate.items as Array<Record<string, unknown>>)[0];
  assert.equal(saleItem.unitPrice, 50);
  assert.equal(saleItem.costPrice, 20);
  assert.equal(saleItem.currency, "KES");
  const customerLookup = calls.find((call) => call.method === "customer.findOne")?.query as Record<string, unknown>;
  assert.deepEqual(customerLookup.$and, [
    { $or: [{ externalId: "customer-external-1" }] },
    {}
  ]);
  assert.ok(calls.some((call) => call.method === "product.findOneAndUpdate"));
  assert.ok(calls.some((call) => call.method === "movement.create"));
  const recordedPayments = calls.find((call) => call.method === "payment.create")?.input as Array<Record<string, unknown>>;
  assert.deepEqual(recordedPayments.map((payment) => [payment.method, payment.amount, payment.reference, payment.externalId]), [
    ["cash", 45, null, "sale-external-1:payment:0"],
    ["mpesa", 50, "MPESA-123", "sale-external-1:payment:1"]
  ]);
  assert.equal(recordedPayments[1]!.status, "pending_confirmation");
  assert.equal(recordedPayments[1]!.reconciledAt, null);

  calls.length = 0;
  await service.create({
    businessId: "business-1",
    externalId: "sale-external-1",
    customerId: "customer-external-1",
    receiptNumber: "R-001",
    amountPaid: 95,
    paymentStatus: "partial",
    paymentMethod: "cash",
    paymentLines: [{ method: "cash", amount: 45 }, { method: "mpesa", amount: 50, reference: "MPESA-123" }],
    items: [{ productId: "QnV7IFpJ6tXuU_wB", quantity: 2, discount: 0 }]
  });
  assert.equal(calls.some((call) => call.method === "sale.create" || call.method === "payment.create" || call.method === "product.findOneAndUpdate"), false, "retry with the same sale key does not post twice");

  calls.length = 0;
  await assert.rejects(() => service.create({
    businessId: "business-1",
    externalId: "sale-invalid-tender",
    receiptNumber: "R-STALE",
    amountPaid: 95,
    paymentStatus: "partial",
    paymentMethod: "cash",
    paymentLines: [{ method: "cash", amount: 94 }],
    items: [{ productId: "QnV7IFpJ6tXuU_wB", quantity: 2, discount: 0 }]
  }), /Payment lines must add up exactly/);
  assert.equal(calls.length, 0, "mismatched tenders are rejected before transaction writes");

  await assert.rejects(() => service.create({
    businessId: "business-1",
    externalId: "sale-invalid-method",
    receiptNumber: "R-METHOD",
    amountPaid: 1,
    paymentStatus: "partial",
    paymentMethod: "cash",
    paymentLines: [{ method: "unsupported" as any, amount: 1 }],
    items: [{ productId: "QnV7IFpJ6tXuU_wB", quantity: 1, discount: 0 }]
  }), /not supported/);
  assert.equal(calls.length, 0, "unsupported payment methods are rejected before transaction writes");

  calls.length = 0;
  await assert.rejects(() => service.create({
    businessId: "business-1",
    externalId: "sale-stale-price",
    receiptNumber: "R-STALE",
    amountPaid: 0,
    paymentStatus: "unpaid",
    paymentMethod: "cash",
    items: [{ productId: "QnV7IFpJ6tXuU_wB", quantity: 1, expectedUnitPrice: 49.99 }]
  }), /catalog price changed/i);
  assert.equal(calls.some((call) => call.method === "sale.create" || call.method === "product.findOneAndUpdate"), false, "stale checkout does not persist a sale or deduct inventory");

  calls.length = 0;
  await service.create({
    businessId: "business-1",
    externalId: "sale-discounted",
    receiptNumber: "R-003",
    amountPaid: 95,
    orderDiscount: 5,
    expectedGrandTotal: 95,
    paymentStatus: "paid",
    paymentMethod: "cash",
    paymentLines: [{ method: "cash", amount: 45 }, { method: "bank", amount: 50, reference: "BANK-1" }],
    items: [{ productId: "QnV7IFpJ6tXuU_wB", quantity: 2, discount: 0, expectedUnitPrice: 50 }]
  });
  const discountedSale = calls.find((call) => call.method === "sale.create")?.input as Record<string, unknown>;
  assert.equal(discountedSale.grandTotal, 95);
  assert.equal(discountedSale.discountTotal, 5);
  assert.equal((discountedSale.items as Array<Record<string, unknown>>)[0]!.lineDiscount, 5);
  assert.deepEqual((calls.find((call) => call.method === "payment.create")?.input as Array<Record<string, unknown>>).map((row) => [row.method, row.amount]), [["cash", 45], ["bank", 50]]);

  calls.length = 0;
  const businessModel = {
    findOne() {
      return { session() { return { lean: async () => ({ currency: "KES", businessType: "retail", taxSettings: { defaultTaxCategory: "vat", defaultTaxRate: 16, defaultTaxInclusive: false } }) }; } };
    }
  };
  const taxedService = new SalesService(saleModel as any, paymentModel as any, movementModel as any, productModel as any, customerModel as any, connection as any, businessModel as any);
  await taxedService.create({
    businessId: "business-1",
    externalId: "sale-taxed",
    receiptNumber: "R-TAX",
    amountPaid: 0,
    orderDiscount: 5,
    expectedGrandTotal: 110.2,
    paymentStatus: "unpaid",
    paymentMethod: "cash",
    items: [{ productId: "QnV7IFpJ6tXuU_wB", quantity: 2, discount: 0, expectedUnitPrice: 50 }]
  });
  const taxedSale = calls.find((call) => call.method === "sale.create")?.input as Record<string, unknown>;
  assert.equal(taxedSale.taxTotal, 15.2);
  assert.equal(taxedSale.grandTotal, 110.2);
  calls.length = 0;
  await assert.rejects(() => taxedService.create({
    businessId: "business-1",
    externalId: "sale-taxed-stale",
    receiptNumber: "R-TAX-STALE",
    amountPaid: 0,
    orderDiscount: 5,
    expectedGrandTotal: 95,
    paymentStatus: "unpaid",
    paymentMethod: "cash",
    items: [{ productId: "QnV7IFpJ6tXuU_wB", quantity: 2, discount: 0, expectedUnitPrice: 50 }]
  }), /tax settings or discounts changed/i);
  assert.equal(calls.some((call) => call.method === "sale.create" || call.method === "product.findOneAndUpdate"), false, "changed tax settings do not create a sale or deduct stock");

  calls.length = 0;
  await service.create({
    businessId: "business-1",
    externalId: "sale-customer-link",
    customerId: "customer-external-1",
    receiptNumber: "R-002",
    amountPaid: 50,
    paymentStatus: "paid",
    paymentMethod: "cash",
    items: [{ productId: "QnV7IFpJ6tXuU_wB", quantity: 1 }]
  });
  const paidSaleCustomerLookup = calls.find((call) => call.method === "customer.findOne")?.query as Record<string, unknown>;
  assert.equal(paidSaleCustomerLookup.businessId, "business-1");
  assert.deepEqual(paidSaleCustomerLookup.$and, [
    { $or: [{ externalId: "customer-external-1" }] },
    {}
  ]);
}

async function testSalesServiceInvalidProductId(SalesService: any) {
  const calls: CallRecord[] = [];
  const productModel = {
    findOne(query: Record<string, unknown>) {
      calls.push({ method: "product.findOne", query });
      return {
        session() {
          return null;
        }
      };
    }
  };

  const saleModel = {
    findOne() { return { lean: async () => null }; },
    create() {
      throw new Error("sale.create should not run for invalid products");
    }
  };

  const paymentModel = {
    create() {
      throw new Error("payment.create should not run for invalid products");
    }
  };

  const movementModel = {
    create() {
      throw new Error("movement.create should not run for invalid products");
    }
  };

  const customerModel = {
    findOne() {
      throw new Error("customer.findOne should not run for invalid products");
    }
  };

  const connection = {
    async startSession() {
      return {
        async withTransaction(work: () => Promise<void>) {
          await work();
        },
        async endSession() {
          return undefined;
        }
      };
    }
  };

  const service = new SalesService(saleModel as any, paymentModel as any, movementModel as any, productModel as any, customerModel as any, connection as any);

  await assert.rejects(
    service.create({
      businessId: "business-1",
      externalId: "sale-invalid-product",
      receiptNumber: "R-002",
      subtotal: 50,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 50,
      amountPaid: 50,
      balanceDue: 0,
      paymentStatus: "paid",
      paymentMethod: "cash",
      notes: null,
      items: [
        {
          productId: "missing-product-999",
          productName: "Unknown",
          quantity: 1,
          unitPrice: 50,
          costPrice: 20,
          lineDiscount: 0,
          lineTotal: 50
        }
      ]
    }),
    (error: any) => {
      const response = typeof error?.getResponse === "function" ? error.getResponse() : null;
      return response?.code === "INVALID_PRODUCT_ID" && typeof response?.message === "string";
    }
  );

  assert.deepEqual(calls[0], {
    method: "product.findOne",
    query: {
      businessId: "business-1",
      deletedAt: null,
      $or: [{ externalId: "missing-product-999" }]
    }
  });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
