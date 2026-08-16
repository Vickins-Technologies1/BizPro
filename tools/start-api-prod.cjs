const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { syncSharedRuntime } = require("./sync-shared-runtime.cjs");

const repoRoot = path.resolve(__dirname, "..");
const apiRoot = path.join(repoRoot, "apps", "api");
const apiDistEntry = path.join(apiRoot, "dist", "main.js");

function buildSharedIfNeeded() {
  const sharedDistEntry = path.join(repoRoot, "packages", "shared", "dist", "index.js");
  if (fs.existsSync(sharedDistEntry)) {
    return;
  }

  const result = spawnSync("pnpm", ["-C", "../..", "--filter", "@vbo/shared", "build"], {
    cwd: apiRoot,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      CI: process.env.CI ?? "true"
    }
  });

  if (result.status !== 0) {
    throw new Error("Failed to build @vbo/shared before starting the API");
  }
}

function main() {
  if (!fs.existsSync(apiDistEntry)) {
    throw new Error(`API build output not found at ${apiDistEntry}`);
  }

  buildSharedIfNeeded();
  syncSharedRuntime();

  const result = spawnSync(process.execPath, ["dist/main.js"], {
    cwd: apiRoot,
    stdio: "inherit",
    env: process.env
  });

  process.exit(result.status ?? 1);
}

main();
