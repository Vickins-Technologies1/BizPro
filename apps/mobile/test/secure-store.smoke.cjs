process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "CommonJS",
  moduleResolution: "Node"
});
require("ts-node/register/transpile-only");

const assert = require("node:assert/strict");
const moduleLoader = require("module");
const originalLoad = moduleLoader._load;
const calls = [];
const values = new Map([["vbo.session", "stored-value"]]);
let failure = null;

moduleLoader._load = function patchedLoad(request, parent, isMain) {
  if (request === "expo-secure-store") {
    return {
      getItemAsync: async (...args) => {
        calls.push(["get", ...args]);
        if (failure) throw failure;
        return values.get(args[0]) ?? null;
      },
      setItemAsync: async (...args) => {
        calls.push(["set", ...args]);
        if (failure) throw failure;
        values.set(args[0], args[1]);
      },
      deleteItemAsync: async (...args) => {
        calls.push(["delete", ...args]);
        if (failure) throw failure;
        values.delete(args[0]);
      }
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

async function main() {
  const { secureStore } = require("../src/storage/secure.ts");

  assert.equal(await secureStore.getSession(), "stored-value");
  await secureStore.setSession(JSON.stringify({
    accessToken: "token-payload",
    user: { id: "user-1", role: "owner" },
    business: { id: "business-1", taxPin: "sensitive-business-data", largeSettings: "x".repeat(3000) },
    branches: [{ id: "branch-1" }]
  }));
  await secureStore.clearSession();
  assert.deepEqual(calls.slice(0, 1), [["get", "vbo.session"]]);
  assert.equal(calls[0].length, 2, "getItemAsync receives only key and no malformed options map");
  assert.equal(calls[1].length, 3, "setItemAsync receives only key and value");
  assert.deepEqual(JSON.parse(calls[1][2]), { accessToken: "token-payload" }, "only the access token is stored in SecureStore");
  assert.equal(calls[1][2].length < 2048, true, "large session metadata cannot exceed the SecureStore value limit");

  await secureStore.setSessionMetadata(JSON.stringify({
    version: 1,
    user: { id: "user-1", role: "owner" },
    business: { id: "business-1", name: "Example" },
    branches: [{ id: "branch-1" }, { id: "branch-2" }],
    selectedBranchId: "branch-1"
  }));
  const savedMetadata = JSON.parse(await secureStore.getSessionMetadata());
  assert.equal(savedMetadata.user.id, "user-1");
  assert.equal(savedMetadata.branches.length, 2, "offline session metadata is restored across per-value secure entries");
  assert.equal([...values.values()].every((value) => value.length < 2048), true, "each SecureStore value stays below the platform limit");
  await secureStore.clearSession();
  assert.equal(values.size, 0, "logout removes the token and associated session metadata");
  assert.equal(calls.filter((call) => call[0] === "delete").every((call) => call.length === 2), true, "deleteItemAsync receives only key");

  await secureStore.setThemeMode("dark");
  assert.equal(await secureStore.getThemeMode(), "dark", "theme preference persists across store reads");
  assert.equal(values.get("vbo.themeMode"), "dark", "theme preference uses its dedicated secure-storage key");

  failure = new Error("native failure containing vbo.session and secret-token");
  await assert.rejects(secureStore.setSession("secret-token"), (error) => {
    assert.equal(error.message.startsWith("Secure storage is unavailable."), true);
    assert.equal(error.message.includes("secret-token"), false);
    assert.equal(error.message.includes("vbo.session"), false);
    return true;
  });
  assert.equal(await secureStore.getSession(), null, "read failures keep startup available without deleting the stored session");
  await assert.rejects(secureStore.clearSession(), /Secure storage is unavailable/);
  console.log("SecureStore argument order and sanitized failure handling passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  moduleLoader._load = originalLoad;
});
