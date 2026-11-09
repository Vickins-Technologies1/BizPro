#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const mobileRoot = path.resolve(__dirname, "..");
const appConfig = JSON.parse(fs.readFileSync(path.join(mobileRoot, "app.json"), "utf8")).expo;
const packageId = "com.bizpro.vickins";
const profile = "production";
const lockPath = path.join(os.tmpdir(), "dira-os-android-production-build.lock");

function fail(message) {
  throw new Error(`Android release preflight failed: ${message}`);
}

function run(command, args, options = {}) {
  const executable = process.platform === "win32" && command === "pnpm" ? "pnpm.cmd" : command;
  const useWindowsCommandShell = process.platform === "win32" && command === "pnpm";
  const result = spawnSync(executable, args, { cwd: mobileRoot, encoding: "utf8", windowsHide: true, ...(useWindowsCommandShell ? { shell: true } : {}), ...options });
  if (result.error) fail(`${command} could not start (${result.error.code || "unknown error"})`);
  if (result.status !== 0) {
    const details = `${result.stderr || ""}\n${result.stdout || ""}`
      .replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, "[redacted MongoDB URI]")
      .replace(/(?:EXPO_TOKEN|EAS_ACCESS_TOKEN|GOOGLE_APPLICATION_CREDENTIALS)=\S+/gi, "[redacted credential]")
      .trim();
    fail(`${command} ${args.join(" ")} exited ${result.status}${details ? `: ${details.slice(-1200)}` : ""}`);
  }
  return result.stdout.trim();
}

function readPlayBaseline() {
  const raw = process.env.ANDROID_PLAY_LAST_UPLOADED_VERSION_CODE;
  if (!raw || !/^\d+$/.test(raw) || Number(raw) < 1) {
    fail("set ANDROID_PLAY_LAST_UPLOADED_VERSION_CODE from Play Console before checking or building");
  }
  return Number(raw);
}

function findVersionCodes(value, results = []) {
  if (!value || typeof value !== "object") return results;
  for (const [key, child] of Object.entries(value)) {
    if (/^(android)?versioncode$/i.test(key) && Number.isInteger(Number(child)) && Number(child) > 0) results.push(Number(child));
    else findVersionCodes(child, results);
  }
  return results;
}

function readRemoteVersionCode() {
  const raw = run("pnpm", ["exec", "eas", "build:version:get", "--platform", "android", "--profile", profile, "--json"]);
  let data;
  try { data = JSON.parse(raw); } catch { fail("EAS did not return parseable JSON; remote version cannot be verified"); }
  const codes = [...new Set(findVersionCodes(data))];
  if (codes.length !== 1) fail("EAS response did not contain exactly one Android versionCode");
  return codes[0];
}

function verifyProjectConfiguration() {
  if (appConfig.android?.package !== packageId) fail(`Android application ID changed; expected ${packageId}`);
  const gradlePath = path.join(mobileRoot, "android", "app", "build.gradle");
  if (!fs.existsSync(gradlePath)) fail("native Android Gradle application config is missing");
  const gradle = fs.readFileSync(gradlePath, "utf8");
  const nativePackage = gradle.match(/applicationId\s+['"]([^'"]+)['"]/);
  const nativeVersionName = gradle.match(/versionName\s+['"]([^'"]+)['"]/);
  if (nativePackage?.[1] !== packageId) fail(`native Android application ID changed; expected ${packageId}`);
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(appConfig.version || ""))) fail("Expo versionName is missing or is not semantic version format");
  if (nativeVersionName?.[1] !== appConfig.version) fail(`native Android versionName ${nativeVersionName?.[1] || "(missing)"} does not match app.json ${appConfig.version}`);
  if (!/signingConfigs\s*\{[\s\S]*?release\s*\{[\s\S]*?storeFile\s+releaseKeystoreFile/.test(gradle)) fail("native release signing must continue to use the configured local keystore reference");
  if (!/buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.release/.test(gradle)) fail("native release build must remain bound to signingConfigs.release");
  const easConfigs = [
    ["mobile", path.join(mobileRoot, "eas.json")],
    ["workspace root", path.resolve(mobileRoot, "..", "..", "eas.json")],
  ].map(([label, file]) => {
    if (!fs.existsSync(file)) fail(`${label} eas.json is missing`);
    return [label, JSON.parse(fs.readFileSync(file, "utf8"))];
  });
  const androidProfiles = ["development", "preview", "production"];
  for (const [label, eas] of easConfigs) {
    if (eas.cli?.appVersionSource !== "remote") fail(`${label} EAS appVersionSource must remain remote`);
    for (const name of androidProfiles) {
      const buildProfile = eas.build?.[name];
      if (!buildProfile?.android) fail(`${label} EAS ${name} Android profile is missing`);
      if (buildProfile.android.autoIncrement !== true) fail(`${label} EAS ${name} Android profile must auto-increment from the shared remote source`);
      if (Object.hasOwn(buildProfile, "autoIncrement")) fail(`${label} EAS ${name} profile has a conflicting profile-level autoIncrement; keep allocation platform-specific and remote`);
    }
  }
  const mobileEas = easConfigs[0][1];
  const rootEas = easConfigs[1][1];
  if (mobileEas.cli.version !== rootEas.cli.version) fail("workspace root and mobile EAS CLI version constraints differ");
  if (mobileEas.build?.[profile]?.credentialsSource !== "local") fail("production signing source changed; inspect and approve signing changes separately");
  if (!fs.existsSync(path.join(mobileRoot, "credentials.json"))) fail("local production credentials.json is missing");
}

function checkRemoteAgainstPlay() {
  verifyProjectConfiguration();
  const playCode = readPlayBaseline();
  const remoteCode = readRemoteVersionCode();
  if (remoteCode < playCode) fail(`EAS remote versionCode ${remoteCode} is below Play Console high-water mark ${playCode}; synchronize EAS remote version before building`);
  console.log(JSON.stringify({
    status: "PASS",
    applicationId: packageId,
    versionName: appConfig.version,
    lastUploadedPlayVersionCode: playCode,
    currentEasRemoteVersionCode: remoteCode,
    nextAndroidBuild: "EAS remote auto-increment; allocated on build submission",
    profile
  }, null, 2));
}

function withBuildLock(action) {
  let fd;
  try { fd = fs.openSync(lockPath, "wx", 0o600); }
  catch (error) {
    if (error.code === "EEXIST") fail(`another local Android production build may be preparing; inspect and remove stale lock only after confirming no build is active (${lockPath})`);
    throw error;
  }
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    return action();
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(lockPath);
  }
}

function validateAab(aabPath) {
  const absoluteAab = path.resolve(aabPath || "");
  const bundletool = process.env.BUNDLETOOL_JAR;
  if (!aabPath || !fs.existsSync(absoluteAab) || path.extname(absoluteAab).toLowerCase() !== ".aab") fail("provide an existing .aab file path");
  if (!bundletool || !fs.existsSync(bundletool)) fail("set BUNDLETOOL_JAR to the official bundletool JAR to inspect the AAB manifest");
  run("java", ["-jar", bundletool, "validate", `--bundle=${absoluteAab}`]);
  const dump = (xpath) => run("java", ["-jar", bundletool, "dump", "manifest", `--bundle=${absoluteAab}`, `--xpath=${xpath}`]);
  const embeddedPackage = dump("/manifest/@package").replace(/^\"|\"$/g, "");
  const embeddedCode = Number(dump("/manifest/@android:versionCode").replace(/^\"|\"$/g, ""));
  const embeddedName = dump("/manifest/@android:versionName").replace(/^\"|\"$/g, "");
  if (embeddedPackage !== packageId) fail(`AAB package ${embeddedPackage || "(missing)"} does not match ${packageId}`);
  if (!Number.isInteger(embeddedCode) || embeddedCode < 1) fail("AAB versionCode is missing or invalid");
  if (embeddedName !== appConfig.version) fail(`AAB versionName ${embeddedName || "(missing)"} does not match app.json ${appConfig.version}`);
  const playCode = readPlayBaseline();
  if (embeddedCode <= playCode) fail(`AAB versionCode ${embeddedCode} is not higher than Play Console high-water mark ${playCode}`);
  run("jarsigner", ["-verify", absoluteAab]);
  console.log(JSON.stringify({ status: "PASS", artifact: absoluteAab, applicationId: embeddedPackage, versionCode: embeddedCode, versionName: embeddedName, higherThanPlayConsoleVersionCode: playCode, signature: "verified; certificate identity still requires comparison with Play upload certificate" }, null, 2));
}

process.on("uncaughtException", (error) => {
  console.error(error instanceof Error ? error.message : "Android release command failed");
  process.exitCode = 1;
});

const [action = "check", ...args] = process.argv.slice(2);
if (action === "config") {
  verifyProjectConfiguration();
  console.log(JSON.stringify({ status: "PASS", applicationId: packageId, versionName: appConfig.version, versionSource: "remote", configFiles: ["apps/mobile/eas.json", "eas.json"] }, null, 2));
} else if (action === "check" || action === "prepare") {
  checkRemoteAgainstPlay();
} else if (action === "build") {
  withBuildLock(() => {
    checkRemoteAgainstPlay();
    run("pnpm", ["exec", "eas", "build", "--platform", "android", "--profile", profile, "--non-interactive", "--no-wait"]);
    console.log("EAS accepted the Android production build request. It owns the versionCode increment; inspect the build in EAS before preparing submission.");
  });
} else if (action === "validate") {
  validateAab(args[0]);
} else {
  fail("usage: pnpm release:android [config|check|prepare|build|validate <artifact.aab>]");
}
