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
const ANDROID_ROOT_BUILD_GRADLE = path.join("android", "build.gradle");
const ANDROID_APP_BUILD_GRADLE = path.join("android", "app", "build.gradle");
const ANDROID_GRADLE_PROPERTIES = path.join("android", "gradle.properties");
const ANDROID_PROGUARD_RULES = path.join("android", "app", "proguard-rules.pro");
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

function patchExpoGradleHelperExtension(contents) {
  return contents.replace(
    "reactNativeDir = reactNativeDirFromSource ?: File(",
    'reactNativeDir = System.getenv("DIRAOS_REACT_NATIVE_DIR")?.let { File(it) } ?: reactNativeDirFromSource ?: File('
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
      '    <activity android:name="com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity" android:screenOrientation="unspecified" tools:replace="android:screenOrientation" tools:ignore="MissingClass" />\n  </application>'
    );
  } else {
    patched = patched.replace(
      /(<activity\s+android:name="com\.google\.mlkit\.vision\.codescanner\.internal\.GmsBarcodeScanningDelegateActivity"[^>]*)(\/>)/,
      (match, activity, closing) => activity.includes('tools:ignore="MissingClass"')
        ? match
        : `${activity} tools:ignore="MissingClass"${closing}`
    );
  }

  if (!patched.includes('android:name="android.hardware.camera"')) {
    patched = patched.replace(
      "  <application",
      '  <uses-feature android:name="android.hardware.camera" android:required="false" />\n  <application'
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

function patchAndroidAppBuildGradle(contents, versionName, versionCode) {
  let patched = contents
    .replace(/^\s*versionCode\s+\d+\s*$/m, `        versionCode ${versionCode}`)
    .replace(/^\s*versionName\s+['"][^'"]+['"]\s*$/m, `        versionName "${versionName}"`);

  if (!/abiFilters\.addAll\(\(findProperty\('reactNativeArchitectures'\)/.test(patched)) {
    patched = patched.replace(
      /^\s*versionName\s+['"][^'"]+['"]\s*$/m,
      (marker) => `${marker}\n        // Ship ARM ABIs for physical devices and x86_64 for Android emulators.\n        ndk {\n            abiFilters.addAll((findProperty('reactNativeArchitectures') ?: 'armeabi-v7a,arm64-v8a,x86_64').split(',') as List)\n        }`
    );
  }

  if (process.platform === "win32") {
    // Keep the React Native source path short enough for Windows Ninja builds.
    const reactNativeDir = (process.env.DIRAOS_REACT_NATIVE_DIR || "../../node_modules/react-native").replace(/\\/g, "/");
    patched = patched
      .replace(/^\s*reactNativeDir = .*$/m, `    reactNativeDir = file("${reactNativeDir}")`)
      .replace(/^\s*hermesCommand = .*$/m, `    hermesCommand = file("${reactNativeDir}/sdks/hermesc/%OS-BIN%/hermesc").absolutePath`);
  }
  return patched;
}

function patchAndroidRootBuildGradle(contents) {
  const marker = "// Use the NDK version selected by expo-build-properties for native app and module builds.";
  if (contents.includes(marker)) return contents;

  return `${contents.trimEnd()}\n\n${marker}\nrootProject.ext.ndkVersion = findProperty("android.ndkVersion") ?: rootProject.ext.ndkVersion\n`;
}

function patchAndroidGradleProperties(contents, versionCode) {
  const required = [
    // Expo SDK and React Native provide scoped consumer rules for reflective APIs.
    "org.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8",
    "android.enableProguardInReleaseBuilds=true",
    "android.enableShrinkResourcesInReleaseBuilds=true",
    "android.ndkVersion=28.1.13356709",
    "reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86_64",
    `versionCode=${versionCode ?? 12}`,
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

function patchAndroidProguardRules(contents) {
  const marker = "# Dira SecureStore R8 compatibility";
  const rules = `${marker}\n# Expo Modules Core uses reflection to convert native bridge maps into Kotlin Record values, including SecureStoreOptions.\n-keep class expo.modules.kotlin.records.** { *; }\n-keepattributes Signature,InnerClasses,EnclosingMethod,RuntimeVisibleAnnotations,RuntimeInvisibleAnnotations,AnnotationDefault`;
  const markerIndex = contents.indexOf(marker);
  if (markerIndex >= 0) {
    const prefix = contents
      .slice(0, markerIndex)
      .replace(/^\s*-keep class com\.swmansion\.reanimated\.\*\* \{ \*; \}\s*$/gm, "")
      .replace(/^\s*-keep class com\.facebook\.react\.turbomodule\.\*\* \{ \*; \}\s*$/gm, "")
      .trimEnd();
    return `${prefix}\n\n${rules}\n`;
  }

  const prefix = contents
    .replace(/^\s*-keep class com\.swmansion\.reanimated\.\*\* \{ \*; \}\s*$/gm, "")
    .replace(/^\s*-keep class com\.facebook\.react\.turbomodule\.\*\* \{ \*; \}\s*$/gm, "")
    .trimEnd();
  return `${prefix}\n\n${rules}\n`;
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
        [ANDROID_ROOT_BUILD_GRADLE, patchAndroidRootBuildGradle],
        [ANDROID_APP_BUILD_GRADLE, (contents) => patchAndroidAppBuildGradle(contents, config.version, config.android?.versionCode)],
        [ANDROID_GRADLE_PROPERTIES, (contents) => patchAndroidGradleProperties(contents, config.android?.versionCode)],
        [ANDROID_PROGUARD_RULES, patchAndroidProguardRules],
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

      const expoGradleHelperPath = path.join(
        path.dirname(expoModulesCorePackageJson),
        "expo-module-gradle-plugin",
        "src",
        "main",
        "kotlin",
        "expo",
        "modules",
        "plugin",
        "gradle",
        "ExpoGradleHelperExtension.kt"
      );

      if (fs.existsSync(expoGradleHelperPath)) {
        const expoGradleHelperCurrent = fs.readFileSync(expoGradleHelperPath, "utf8");
        const expoGradleHelperPatched = patchExpoGradleHelperExtension(expoGradleHelperCurrent);
        if (expoGradleHelperPatched !== expoGradleHelperCurrent) {
          fs.writeFileSync(expoGradleHelperPath, expoGradleHelperPatched);
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
