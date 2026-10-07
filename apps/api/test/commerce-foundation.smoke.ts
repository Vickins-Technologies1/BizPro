import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CommerceApiCredentialSchema, CommerceOrderSchema, InventoryReservationSchema } from "../src/modules/commerce.schemas";
import { CommerceApiGuard, CommerceRateLimiter, CommerceScopeGuard } from "../src/common/commerce-api.guard";
import { assertBranchAccess, hashRequest } from "../src/modules/commerce/commerce.helpers";
import { CommerceIdempotencyService } from "../src/modules/commerce/idempotency.service";

async function main() {
  assert.deepEqual(InventoryReservationSchema.path("status")?.enumValues, ["RESERVED", "RELEASED", "COMMITTED", "EXPIRED"]);
  assert.deepEqual(CommerceOrderSchema.path("source")?.enumValues, ["INTERNAL", "EXTERNAL_API", "MARKETPLACE"]);
  assert.deepEqual(CommerceApiCredentialSchema.path("status")?.enumValues, ["ACTIVE", "REVOKED"]);

  const principal = { credentialId: "credential-1", businessId: "business-1", scopes: ["orders:write"], branchIds: ["branch-1"], rateLimitPerMinute: 10 };
  assert.doesNotThrow(() => assertBranchAccess(principal, "branch-1"));
  assert.throws(() => assertBranchAccess(principal, "branch-2"), /not allowed/);
  assert.equal(hashRequest({ b: 2, a: 1 }), hashRequest({ a: 1, b: 2 }));

  const limiter = new CommerceRateLimiter();
  limiter.check("one", 1);
  assert.throws(() => limiter.check("one", 1), /rate limit/);

  const secret = "secret-value";
  let credentialActive = true;
  const credentialModel = {
    findOne: () => ({ select: () => ({ lean: async () => credentialActive ? { _id: "credential-doc", keyId: "key-1", businessId: "business-1", secretHash: createHash("sha256").update(secret).digest("hex"), scopes: ["products:read"], branchIds: ["branch-1"], rateLimitPerMinute: 10, status: "ACTIVE", expiresAt: null } : null }) }),
    updateOne: async () => undefined
  };
  const request = { headers: { "x-api-key": "key-1.secret-value" } };
  const context = { switchToHttp: () => ({ getRequest: () => request }) };
  const apiGuard = new CommerceApiGuard(credentialModel as never, new CommerceRateLimiter());
  assert.equal(await apiGuard.canActivate(context as never), true);
  assert.equal((request as any).commerceAuth.businessId, "business-1");
  credentialActive = false;
  await assert.rejects(() => apiGuard.canActivate(context as never), /invalid or expired/);

  const scopeGuard = new CommerceScopeGuard({ getAllAndOverride: () => ["orders:write"] } as never);
  const scopeContext = { getHandler: () => undefined, getClass: () => undefined, switchToHttp: () => ({ getRequest: () => ({ commerceAuth: { scopes: ["products:read"] } }) }) };
  assert.throws(() => scopeGuard.canActivate(scopeContext as never), /scope is not granted/);

  const records = new Map<string, any>();
  const recordModel = {
    findOne: (query: any) => ({ lean: async () => records.get(`${query.businessId}:${query.credentialId}:${query.operation}:${query.key}`) ?? null }),
    create: async (value: any) => { records.set(`${value.businessId}:${value.credentialId}:${value.operation}:${value.key}`, { ...value }); return value; },
    updateOne: async (query: any, update: any) => { const key = `${query.businessId}:${query.credentialId}:${query.operation}:${query.key}`; records.set(key, { ...records.get(key), ...update.$set }); }
  };
  const idempotency = new CommerceIdempotencyService(recordModel as never);
  let executions = 0;
  const first = await idempotency.execute(principal, "orders.create", "request-1", { item: "one" }, async () => { executions += 1; return { id: "order-1" }; });
  const second = await idempotency.execute(principal, "orders.create", "request-1", { item: "one" }, async () => { executions += 1; return { id: "order-2" }; });
  assert.equal(first.id, "order-1");
  assert.equal(second.id, "order-1");
  assert.equal(executions, 1);
  await assert.rejects(() => idempotency.execute(principal, "orders.create", "request-1", { item: "two" }, async () => ({ id: "order-3" })), /different request/);

  console.log("Commerce foundation smoke tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
