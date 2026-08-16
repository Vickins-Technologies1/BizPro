const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const sharedDist = path.join(repoRoot, "packages", "shared", "dist");
const apiNodeModules = path.join(repoRoot, "apps", "api", "node_modules", "@vbo", "shared");

function syncSharedRuntime() {
  if (!fs.existsSync(sharedDist)) {
    throw new Error(`Shared build output not found at ${sharedDist}`);
  }

  fs.mkdirSync(apiNodeModules, { recursive: true });
  fs.cpSync(sharedDist, apiNodeModules, {
    recursive: true,
    force: true,
    dereference: true
  });
}

if (require.main === module) {
  syncSharedRuntime();
}

module.exports = { syncSharedRuntime };
