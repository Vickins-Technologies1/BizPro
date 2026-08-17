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
  const { BusinessesService, CustomersService, JwtStrategy, ProductsService, SalesService } = loadServices();
  await testProductsService(ProductsService);
  await testCustomersService(CustomersService);
  await testCustomersListWithInvalidAttachmentDate(CustomersService);
  await testBusinessesService(BusinessesService);
  await testJwtStrategyBusinessLookup(JwtStrategy);
  await testSalesService(SalesService);
  await testSalesServiceInvalidProductId(SalesService);
  console.log("Tenant safety smoke checks passed.");
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
    JwtStrategy: require("../src/modules/auth/jwt.strategy").JwtStrategy as any
  };
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
    name: "Biz Pro",
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
  await service.update("JBs-VOAjsYEjB9bb", { name: "Biz Pro Updated" });
  assert.deepEqual(calls[0], {
    method: "business.findOneAndUpdate",
    query: {
      deletedAt: null,
      $or: [{ externalId: "JBs-VOAjsYEjB9bb" }]
    },
    update: { name: "Biz Pro Updated" },
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
    name: "Biz Pro",
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

  const strategy = new JwtStrategy({ get: () => "secret" } as any, userModel as any, businessModel as any);
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
    stockOnHand: 10
  });
  const customerDoc = createDoc({
    _id: "customer-1",
    businessId: "business-1",
    balance: 40
  });

  const saleModel = {
    create(input: Record<string, unknown>) {
      const payload = Array.isArray(input) ? input[0] ?? {} : input;
      calls.push({ method: "sale.create", input: payload });
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
      const payload = Array.isArray(input) ? input[0] ?? {} : input;
      calls.push({ method: "payment.create", input: payload });
      return Promise.resolve([
        {
          ...payload,
          toObject: () => ({ ...payload })
        }
      ]);
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
    customerId: "customer-1",
    receiptNumber: "R-001",
    subtotal: 100,
    discountTotal: 0,
    taxTotal: 0,
    grandTotal: 100,
    amountPaid: 95,
    balanceDue: 5,
    paymentStatus: "partial",
    paymentMethod: "cash",
    notes: null,
    items: [
      {
        productId: "QnV7IFpJ6tXuU_wB",
        productName: "Tea",
        quantity: 2,
        unitPrice: 50,
        costPrice: 20,
        lineDiscount: 0,
        lineTotal: 100
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
  assert.deepEqual(calls[1], {
    method: "sale.create",
    input: {
      businessId: "business-1",
      branchId: null,
      customerId: "customer-1",
      receiptNumber: "R-001",
      subtotal: 100,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 100,
      amountPaid: 95,
      balanceDue: 5,
      paymentStatus: "partial",
      paymentMethod: "cash",
      notes: null,
      items: [
        {
          productId: "QnV7IFpJ6tXuU_wB",
          productName: "Tea",
          quantity: 2,
          unitPrice: 50,
          costPrice: 20,
          lineDiscount: 0,
          lineTotal: 100
        }
      ],
      deletedAt: null
    }
  });
  assert.deepEqual(calls[2], {
    method: "movement.create",
    input: {
      businessId: "business-1",
      branchId: null,
      productId: "QnV7IFpJ6tXuU_wB",
      referenceType: "sale",
      referenceId: "sale-1",
      quantityDelta: -2,
      unitCost: 20,
      note: "Sale R-001"
    }
  });
  assert.deepEqual(calls[3], {
    method: "customer.findOne",
    query: { _id: "customer-1", businessId: "business-1", deletedAt: null }
  });
  assert.deepEqual(calls[4], {
    method: "payment.create",
    input: {
      businessId: "business-1",
      branchId: null,
      customerId: "customer-1",
      saleId: "sale-1",
      debtPaymentId: null,
      externalId: null,
      method: "cash",
      status: "partial",
      amount: 95,
      reference: null,
      note: null,
      provider: null,
      reconciledAt: null
    }
  });
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
