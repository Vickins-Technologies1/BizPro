const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

const PACKAGE_BUILD_GRADLE = path.join(
  "node_modules",
  "@brooons",
  "react-native-bluetooth-escpos-printer",
  "android",
  "build.gradle",
);

function patchBluetoothEscposGradle(contents) {
  return contents
    .replace(/compileSdkVersion\s+28/g, "compileSdkVersion rootProject.ext.compileSdkVersion")
    .replace(/buildToolsVersion\s+"28\.0\.3"/g, "buildToolsVersion rootProject.ext.buildToolsVersion")
    .replace(/minSdkVersion\s+16/g, "minSdkVersion rootProject.ext.minSdkVersion")
    .replace(/targetSdkVersion\s+24/g, "targetSdkVersion rootProject.ext.targetSdkVersion");
}

function patchExpoModulesCoreGradle(contents) {
  return contents.replace(
    /from components\.release/g,
    'from components.findByName("release")'
  );
}

module.exports = function withPatchedBluetoothEscpos(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const buildGradlePath = path.join(config.modRequest.projectRoot, PACKAGE_BUILD_GRADLE);

      if (!fs.existsSync(buildGradlePath)) {
        throw new Error(`Bluetooth ESC/POS Gradle file not found at ${buildGradlePath}`);
      }

      const current = fs.readFileSync(buildGradlePath, "utf8");
      const patched = patchBluetoothEscposGradle(current);

      if (patched !== current) {
        fs.writeFileSync(buildGradlePath, patched);
      }

      const expoModulesCorePackageJson = require.resolve("expo-modules-core/package.json", {
        paths: [config.modRequest.projectRoot]
      });
      const expoModulesCoreGradlePath = path.join(path.dirname(expoModulesCorePackageJson), "android", "ExpoModulesCorePlugin.gradle");

      if (fs.existsSync(expoModulesCoreGradlePath)) {
        const expoModulesCurrent = fs.readFileSync(expoModulesCoreGradlePath, "utf8");
        const expoModulesPatched = patchExpoModulesCoreGradle(expoModulesCurrent);

        if (expoModulesPatched !== expoModulesCurrent) {
          fs.writeFileSync(expoModulesCoreGradlePath, expoModulesPatched);
        }
      }

      return config;
    },
  ]);
};
