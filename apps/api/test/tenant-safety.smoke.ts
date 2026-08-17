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
  const { CustomersService, ProductsService, SalesService } = loadServices();
  await testProductsService(ProductsService);
  await testCustomersService(CustomersService);
  await testCustomersListWithInvalidAttachmentDate(CustomersService);
  await testSalesService(SalesService);
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
    ProductsService: require("../src/modules/products/products.service").ProductsService as any,
    CustomersService: require("../src/modules/customers/customers.service").CustomersService as any,
    SalesService: require("../src/modules/sales/sales.service").SalesService as any
  };
}

async function testProductsService(ProductsService: any) {
  const calls: CallRecord[] = [];
  const productDoc = createDoc({
    _id: "product-1",
    businessId: "business-1",
    stockOnHand: 10,
    deletedAt: null
  });

  const updatedProduct = {
    _id: "product-1",
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

  const updated = await service.update("business-1", "product-1", { businessId: "other-business", name: "Updated" });
  assert.equal(updated.name, "Updated");
  assert.deepEqual(calls[0], {
    method: "findOneAndUpdate",
    query: { _id: "product-1", businessId: "business-1" },
    update: { name: "Updated" },
    options: { new: true }
  });

  calls.length = 0;
  const archived = await service.archive("business-1", "product-1");
  assert.equal(archived.deletedAt instanceof Date || archived.deletedAt === undefined || archived.deletedAt === null, true);
  assert.equal(calls[0].method, "findOneAndUpdate");
  assert.deepEqual(calls[0].query, { _id: "product-1", businessId: "business-1" });
  assert.equal((calls[0].update as Record<string, unknown>).isActive, false);
  assert.ok((calls[0].update as Record<string, unknown>).deletedAt instanceof Date);
  assert.deepEqual(calls[0].options, { new: true });

  calls.length = 0;
  await service.adjustStock({
    businessId: "business-1",
    productId: "product-1",
    referenceType: "adjustment",
    referenceId: "movement-1",
    quantityDelta: -2,
    unitCost: 100,
    note: "Adjustment"
  });

  assert.deepEqual(calls[0], {
    method: "findOne",
    query: { _id: "product-1", businessId: "business-1", deletedAt: null }
  });
  assert.deepEqual(calls[1], {
    method: "movement.findOne",
    query: {
      businessId: "business-1",
      productId: "product-1",
      referenceType: "adjustment",
      referenceId: "movement-1"
    }
  });
  assert.deepEqual(calls[2], {
    method: "movement.create",
    input: {
      businessId: "business-1",
      branchId: null,
      productId: "product-1",
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

async function testSalesService(SalesService: any) {
  const calls: CallRecord[] = [];
  const productDoc = createDoc({
    _id: "product-1",
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
        productId: "product-1",
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
          productId: "product-1",
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

  assert.deepEqual(calls[1], {
    method: "product.findOne",
    query: { _id: "product-1", businessId: "business-1", deletedAt: null }
  });
  assert.deepEqual(calls[2], {
    method: "movement.create",
    input: {
      businessId: "business-1",
      branchId: null,
      productId: "product-1",
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

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
