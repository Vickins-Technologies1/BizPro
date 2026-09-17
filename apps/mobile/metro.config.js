const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = process.env.DIRAOS_MOBILE_ROOT || __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const expoModulesCoreRoot = process.env.DIRAOS_EXPO_MODULES_CORE || path.resolve(workspaceRoot, "node_modules/expo-modules-core");

const config = getDefaultConfig(projectRoot);
const mobileReactRoot = path.resolve(projectRoot, "node_modules/react");

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

config.watchFolders = [workspaceRoot, expoModulesCoreRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules")
];
// This workspace contains apps with different React major versions. Metro must
// not resolve React for a mobile dependency from the workspace-level React 18
// installation while the mobile app renders with React 19.
config.resolver.extraNodeModules = {
  "@babel/runtime": process.env.DIRAOS_BABEL_RUNTIME || path.resolve(projectRoot, "node_modules/@babel/runtime"),
  "expo-modules-core": expoModulesCoreRoot,
  react: mobileReactRoot,
  "react-native": path.resolve(projectRoot, "node_modules/react-native")
};
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
