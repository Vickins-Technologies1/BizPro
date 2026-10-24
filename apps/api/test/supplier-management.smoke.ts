import "reflect-metadata";
import assert from "node:assert/strict";

type Call = { method: string; args: unknown[] };

async function main() {
  const calls: Call[] = [];
  const moduleLoader = require("module") as typeof import("module");
  const originalLoad = moduleLoader._load;
  const mongooseModule = require("@nestjs/mongoose");
  moduleLoader._load = function patchedLoad(request: string, parent: NodeModule | null, isMain: boolean) {
    if (request === "@nestjs/mongoose") return { ...mongooseModule, Prop: () => () => undefined };
    return originalLoad.call(this, request, parent, isMain);
  };
  const suppliers = new Proxy({}, {
    get(_target, property: string) {
      return (...args: unknown[]) => {
        calls.push({ method: property, args });
        return args[0];
      };
    }
  });
  const { SuppliersController } = require("../src/modules/suppliers/suppliers.controller") as {
    SuppliersController: new (service: unknown) => Record<string, (...args: any[]) => unknown>;
  };
  const controller = new SuppliersController(suppliers);

  await controller.create({ businessId: "business-current" }, { businessId: "business-forged", name: "Northwind" });
  assert.deepEqual(calls.pop(), {
    method: "create",
    args: [{ businessId: "business-current", name: "Northwind", categoryId: null }]
  });

  await controller.createCategory(
    { businessId: "business-current" },
    { businessId: "business-forged", name: "Packaging", sortOrder: 3 }
  );
  assert.deepEqual(calls.pop(), {
    method: "createCategory",
    args: [{
      businessId: "business-current",
      name: "Packaging",
      sortOrder: 3,
      externalId: null,
      description: null,
      color: null,
      isActive: true
    }]
  });

  await controller.createContact(
    { businessId: "business-current" },
    "supplier-7",
    { name: "Accounts", isPrimary: true }
  );
  assert.deepEqual(calls.pop(), {
    method: "createContact",
    args: [{
      businessId: "business-current",
      supplierId: "supplier-7",
      name: "Accounts",
      isPrimary: true,
      role: null,
      phone: null,
      email: null,
      notes: null
    }]
  });

  await controller.createPayment(
    { businessId: "business-current", sub: "user-4" },
    "supplier-7",
    { amount: 1250, method: "mpesa", paymentDate: "2026-10-20T00:00:00.000Z" }
  );
  const payment = calls.pop();
  assert.equal(payment?.method, "createPayment");
  const paymentInput = payment?.args[0] as Record<string, unknown>;
  assert.equal(paymentInput.businessId, "business-current");
  assert.equal(paymentInput.supplierId, "supplier-7");
  assert.equal(paymentInput.recordedById, "user-4");
  assert.ok(paymentInput.paymentDate instanceof Date);
  assert.equal((paymentInput.paymentDate as Date).toISOString(), "2026-10-20T00:00:00.000Z");

  await controller.listPayments({ businessId: "business-current" }, "supplier-7", "2026-10-01", "2026-10-20");
  assert.deepEqual(calls.pop(), {
    method: "listPayments",
    args: ["business-current", "supplier-7", "2026-10-01", "2026-10-20"]
  });

  console.log("Supplier management smoke checks passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
