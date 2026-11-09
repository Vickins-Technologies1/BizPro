const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const projectRoot = process.env.DIRAOS_MOBILE_ROOT || __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const realMobileRoot = process.env.DIRAOS_REAL_MOBILE_ROOT || projectRoot;
const realWorkspaceRoot = process.env.DIRAOS_REAL_WORKSPACE_ROOT || workspaceRoot;
const expoModulesCorePath = process.env.DIRAOS_EXPO_MODULES_CORE || path.resolve(workspaceRoot, "node_modules/expo-modules-core");
// The workspace's node_modules entry is a Windows junction to the checked-in
// expo-modules-core-copy directory. Watching both aliases makes Metro's TreeFS
// register the same path once as a file and once as a directory.
const expoModulesCoreRoot = fs.realpathSync.native(expoModulesCorePath);
const pnpmVirtualStore = process.env.DIRAOS_PNPM_VIRTUAL_STORE;

const canonicalPath = (value) => {
  const absolute = path.resolve(value);
  try {
    return fs.realpathSync.native(absolute);
  } catch {
    return absolute;
  }
};
const canonicalWorkspaceRoot = canonicalPath(realWorkspaceRoot);
const expoModulesCoreRelativePath = path.relative(canonicalWorkspaceRoot, expoModulesCoreRoot);
const expoModulesCoreIsInsideWorkspace = expoModulesCoreRelativePath === "" ||
  (!expoModulesCoreRelativePath.startsWith(`..${path.sep}`) && expoModulesCoreRelativePath !== ".." && !path.isAbsolute(expoModulesCoreRelativePath));
const watchFolders = [
  projectRoot,
  workspaceRoot,
  realWorkspaceRoot,
  ...(!expoModulesCoreIsInsideWorkspace ? [expoModulesCoreRoot] : []),
  ...(pnpmVirtualStore ? [path.resolve(pnpmVirtualStore)] : [])
].map(canonicalPath);

const config = getDefaultConfig(projectRoot);
const mobileReactRoot = path.resolve(realMobileRoot, "node_modules/react");

// This is a pnpm workspace with other apps that still use React 18. Metro can
// otherwise resolve expo modules' peer React from the workspace store, creating
// elements that React Native's React 19 renderer rejects at runtime.
const reactRuntimeFiles = {
  react: path.join(mobileReactRoot, "index.js"),
  "react/jsx-runtime": path.join(mobileReactRoot, "jsx-runtime.js"),
  "react/jsx-dev-runtime": path.join(mobileReactRoot, "jsx-dev-runtime.js")
};

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const runtimeFile = reactRuntimeFiles[moduleName];
  if (runtimeFile) {
    return { type: "sourceFile", filePath: runtimeFile };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

// Keep both paths available for local Windows builds that use a short `subst`
// drive. Metro resolves some pnpm junction targets through that mapped root.
config.watchFolders = [...new Set(watchFolders)];
config.resolver.nodeModulesPaths = [
  path.resolve(realMobileRoot, "node_modules"),
  path.resolve(realWorkspaceRoot, "node_modules")
];
// This workspace contains apps with different React major versions. Metro must
// not resolve React for a mobile dependency from the workspace-level React 18
// installation while the mobile app renders with React 19.
config.resolver.extraNodeModules = {
  "@babel/runtime": process.env.DIRAOS_BABEL_RUNTIME || path.resolve(projectRoot, "node_modules/@babel/runtime"),
  "@expo/vector-icons": process.env.DIRAOS_VECTOR_ICONS_ROOT || path.resolve(realMobileRoot, "node_modules/@expo/vector-icons"),
  "expo-modules-core": expoModulesCoreRoot,
  react: mobileReactRoot,
  "react-native": path.resolve(realMobileRoot, "node_modules/react-native")
};
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
