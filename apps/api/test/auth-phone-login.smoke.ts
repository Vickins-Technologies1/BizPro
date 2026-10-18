import assert from "node:assert/strict";
import "reflect-metadata";
import bcrypt from "bcryptjs";

async function main() {
  const AuthService = loadAuthService();
  const passwordHash = await bcrypt.hash("Secure pass 123!", 4);
  assert.notEqual(passwordHash, "Secure pass 123!", "stored passwords must not be plaintext");
  const storedUser = {
    _id: "user-1",
    businessId: "business-1",
    fullName: "Test Owner",
    phone: "+254712345678",
    phoneLocal: "0712345678",
    passwordHash,
    pinHash: null,
    role: "owner",
    isActive: true,
    deletedAt: null
  };

  const userModel = {
    findOne(filter: Record<string, unknown>) {
      const matched = Object.entries(filter).every(([key, value]) => (storedUser as any)[key] === value);
      return {
        select() { return this; },
        async lean() { return matched ? storedUser : null; }
      };
    },
    find(filter: Record<string, unknown>) {
      const phonePattern = filter.phone as RegExp;
      return {
        select() { return this; },
        async lean() { return phonePattern?.test(storedUser.phone) ? [storedUser] : []; }
      };
    }
  };
  const makeService = (model: any) => new AuthService(
    {} as any,
    {} as any,
    model as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { sign: () => "test-access-token" } as any,
    {} as any
  ) as any;
  const configure = (instance: any) => {
    instance.findBusiness = async () => ({
    _id: "business-1",
    name: "Test Business",
    slug: "test-business",
    industryKey: "retail",
    businessType: "retail_shop",
    currency: "KES",
    planTier: "command",
    billingStatus: "trial"
  });
    instance.issueToken = () => ({ accessToken: "test-access-token", user: { id: "user-1", businessId: "business-1", role: "owner", fullName: "Test Owner" }, business: { id: "business-1" } });
    instance.auditAuthEvent = async () => undefined;
    instance.loadBranches = async () => [];
    return instance;
  };
  const service = configure(makeService(userModel));

  const result = await service.login({ identifier: "0712 345 678", passwordOrPin: "Secure pass 123!" });
  assert.equal(result.accessToken, "test-access-token", "local signup phone format should authenticate after logout");

  storedUser.passwordHash = await bcrypt.hash("Pass 🔐 with spaces!", 4);
  const unicodeResult = await service.login({ identifier: "0712 345 678", passwordOrPin: "Pass 🔐 with spaces!" });
  assert.equal(unicodeResult.accessToken, "test-access-token", "spaces and Unicode password characters should be preserved");
  storedUser.passwordHash = passwordHash;

  await assert.rejects(
    service.login({ identifier: "0712 345 678", passwordOrPin: "Wrong password 123!" }),
    (error: any) => error?.status === 401,
    "incorrect passwords must remain rejected"
  );
  await assert.rejects(
    service.login({ identifier: "0799 000 111", passwordOrPin: "Secure pass 123!" }),
    (error: any) => error?.status === 401,
    "unknown phone identifiers must remain rejected"
  );

  const legacyUser = { ...storedUser, phoneLocal: null };
  const legacyModel = {
    findOne() {
      return { select() { return this; }, async lean() { return null; } };
    },
    find(filter: Record<string, unknown>) {
      const phonePattern = filter.phone as RegExp;
      return {
        select() { return this; },
        async lean() { return phonePattern?.test(legacyUser.phone) ? [legacyUser] : []; }
      };
    }
  };
  const legacyService = configure(makeService(legacyModel));
  const legacyResult = await legacyService.login({ identifier: "0712 345 678", passwordOrPin: "Secure pass 123!" });
  assert.equal(legacyResult.accessToken, "test-access-token", "legacy international-only records should accept the same national phone format");

  console.log("Auth phone login smoke test passed.");
}

function loadAuthService() {
  const moduleLoader = require("module") as typeof import("module");
  const originalLoad = moduleLoader._load;
  const mongooseModule = require("@nestjs/mongoose");
  moduleLoader._load = function patchedLoad(request: string, parent: NodeModule | null, isMain: boolean) {
    if (request === "@nestjs/mongoose") {
      return { ...mongooseModule, Prop: () => () => undefined };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  return require("../src/modules/auth/auth.service").AuthService as any;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
