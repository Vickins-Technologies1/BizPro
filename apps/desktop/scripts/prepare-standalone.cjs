const fs = require("node:fs");
const path = require("node:path");

const appRoot = path.join(__dirname, "..");
const standaloneAppRoot = path.join(appRoot, ".next", "standalone", "apps", "desktop");

function copyIfExists(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

if (!fs.existsSync(standaloneAppRoot)) {
  throw new Error(`Next standalone app output was not found at ${standaloneAppRoot}`);
}

copyIfExists(path.join(appRoot, ".next", "static"), path.join(standaloneAppRoot, ".next", "static"));
copyIfExists(path.join(appRoot, "public"), path.join(standaloneAppRoot, "public"));
copyIfExists(path.join(appRoot, "..", "mobile", "assets", "brand", "dira-os-logo.png"), path.join(appRoot, "resources", "dira-os-logo.png"));

console.log("Prepared Dira OS desktop standalone assets.");
