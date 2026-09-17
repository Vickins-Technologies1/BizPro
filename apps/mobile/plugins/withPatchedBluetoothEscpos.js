const fs = require("fs");
const path = require("path");
const { withAndroidStyles, withDangerousMod } = require("expo/config-plugins");

const PACKAGE_BUILD_GRADLE = path.join(
  "node_modules",
  "@brooons",
  "react-native-bluetooth-escpos-printer",
  "android",
  "build.gradle",
);
const REACT_NATIVE_SCREENS_STACK = path.join(
  "node_modules",
  "react-native-screens",
  "android",
  "src",
  "main",
  "java",
  "com",
  "swmansion",
  "rnscreens",
  "ScreenStack.kt",
);
const ANDROID_MANIFEST = path.join("android", "app", "src", "main", "AndroidManifest.xml");
const ANDROID_GRADLE_PROPERTIES = path.join("android", "gradle.properties");
const ANDROID_STYLES = path.join("android", "app", "src", "main", "res", "values", "styles.xml");
const ANDROID_STRINGS = path.join("android", "app", "src", "main", "res", "values", "strings.xml");

function patchBluetoothEscposGradle(contents) {
  return contents
    .replace(/\s*implementation\s+group:\s*['"]com\.android\.support['"],\s*name:\s*['"]support-v4['"],\s*version:\s*['"]27\.0\.0['"]\s*/g, "\n")
    .replace(/compileSdkVersion\s*(=)?\s*\d+/g, "compileSdkVersion rootProject.ext.compileSdkVersion")
    .replace(/compileSdk\s*(=)?\s*\d+/g, "compileSdkVersion rootProject.ext.compileSdkVersion")
    .replace(/buildToolsVersion\s+"28\.0\.3"/g, "buildToolsVersion rootProject.ext.buildToolsVersion")
    .replace(/buildToolsVersion\s*(=)?\s*"[^"]+"/g, "buildToolsVersion rootProject.ext.buildToolsVersion")
    .replace(/minSdkVersion\s*(=)?\s*\d+/g, "minSdkVersion rootProject.ext.minSdkVersion")
    .replace(/targetSdkVersion\s*(=)?\s*\d+/g, "targetSdkVersion rootProject.ext.targetSdkVersion");
}

function patchExpoModulesCoreGradle(contents) {
  return contents.replace(
    /from components\.release/g,
    'from components.findByName("release")'
  );
}

function patchExpoModulesCorePermissionsService(contents) {
  return contents.replace(
    /return requestedPermissions\.contains\(permission\)/g,
    "return requestedPermissions?.contains(permission) == true"
  );
}

function patchReactNativeScreens(contents) {
  return contents.replace(
    /drawingOpPool\.removeLast\(\)/g,
    "drawingOpPool.removeAt(drawingOpPool.lastIndex)"
  );
}

function patchAndroidWindowConfiguration(contents) {
  let patched = contents
    .replace(/\sandroid:screenOrientation="portrait"/g, "")
    .replace(/\s*<property android:name="android\.window\.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY" android:value="true"\/>\r?\n/g, "");

  if (!patched.includes("xmlns:tools=")) {
    patched = patched.replace(
      '<manifest xmlns:android="http://schemas.android.com/apk/res/android">',
      '<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">'
    );
  }

  if (!patched.includes("GmsBarcodeScanningDelegateActivity")) {
    patched = patched.replace(
      "  </application>",
      '    <activity android:name="com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity" android:screenOrientation="unspecified" tools:replace="android:screenOrientation" />\n  </application>'
    );
  }

  return patched;
}

function patchAndroidStyles(contents) {
  return contents.replace(/<item name="android:statusBarColor">[^<]+<\/item>\s*/g, "");
}

function patchAndroidStrings(contents) {
  return contents.replace(/\s*<string name="expo_splash_screen_status_bar_translucent"[^>]*>[^<]*<\/string>\r?\n/g, "");
}

function patchAndroidGradleProperties(contents) {
  const required = [
    "android.enableProguardInReleaseBuilds=true",
    "android.enableShrinkResourcesInReleaseBuilds=true",
  ];

  let patched = contents;
  for (const property of required) {
    const key = property.split("=")[0];
    const expression = new RegExp(`^${key.replace(/\./g, "\\.")}=.*$`, "m");
    if (expression.test(patched)) {
      patched = patched.replace(expression, property);
    } else {
      patched = `${patched.trimEnd()}\n${property}\n`;
    }
  }
  return patched;
}

module.exports = function withPatchedBluetoothEscpos(config) {
  config = withAndroidStyles(config, (config) => {
    const styles = config.modResults?.resources?.style ?? [];
    for (const style of styles) {
      style.item = (style.item ?? []).filter(
        (item) => item.$?.name !== "android:statusBarColor"
      );
    }
    return config;
  });

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

      const screensPath = path.join(config.modRequest.projectRoot, REACT_NATIVE_SCREENS_STACK);
      if (fs.existsSync(screensPath)) {
        const screensCurrent = fs.readFileSync(screensPath, "utf8");
        const screensPatched = patchReactNativeScreens(screensCurrent);

        if (screensPatched !== screensCurrent) {
          fs.writeFileSync(screensPath, screensPatched);
        }
      }

      for (const [relativePath, patchFile] of [
        [ANDROID_MANIFEST, patchAndroidWindowConfiguration],
        [ANDROID_GRADLE_PROPERTIES, patchAndroidGradleProperties],
        [ANDROID_STYLES, patchAndroidStyles],
        [ANDROID_STRINGS, patchAndroidStrings]
      ]) {
        const androidFilePath = path.join(config.modRequest.projectRoot, relativePath);
        if (!fs.existsSync(androidFilePath)) continue;
        const androidCurrent = fs.readFileSync(androidFilePath, "utf8");
        const androidPatched = patchFile(androidCurrent);
        if (androidPatched !== androidCurrent) {
          fs.writeFileSync(androidFilePath, androidPatched);
        }
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

      const expoModulesCorePermissionsPath = path.join(
        path.dirname(expoModulesCorePackageJson),
        "android",
        "src",
        "main",
        "java",
        "expo",
        "modules",
        "adapters",
        "react",
        "permissions",
        "PermissionsService.kt"
      );

      if (fs.existsSync(expoModulesCorePermissionsPath)) {
        const permissionsCurrent = fs.readFileSync(expoModulesCorePermissionsPath, "utf8");
        const permissionsPatched = patchExpoModulesCorePermissionsService(permissionsCurrent);

        if (permissionsPatched !== permissionsCurrent) {
          fs.writeFileSync(expoModulesCorePermissionsPath, permissionsPatched);
        }
      }

      return config;
    },
  ]);
};
