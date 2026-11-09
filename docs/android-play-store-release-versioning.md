# Android Play Store release versioning

## Authoritative source and project identity

EAS remote app versions are the authoritative Android `versionCode` source: both root `eas.json` and `apps/mobile/eas.json` specify `cli.appVersionSource: "remote"`. The development, preview, and production Android profiles enable `android.autoIncrement: true`, so Android builds from internal, closed, open, and production workflows consume one project/platform sequence. `apps/mobile/app.json` `version` remains the human facing semantic `versionName`; update that value for patch/minor/major releases. Do not increment Gradle `versionCode` manually for EAS builds.

The current existing Play application identity is `com.bizpro.vickins` (also in `android/app/build.gradle`). Keep that package name and the existing local production signing source. Production `credentialsSource` remains `local`; the release helper checks that the credentials file exists without reading or printing it. It does not create or replace signing keys. Play App Signing compatibility still needs a release owner to compare the AAB upload certificate fingerprint with Play Console.

EAS remote versions are not initialized from Google Play automatically. Before the first build under this configuration, read the highest version code already used in any Play track, including internal, closed, open, and production, and initialize EAS to that value. EAS remote version docs describe remote storage, `autoIncrement`, and `eas build:version:set` initialization: [Expo app version management](https://docs.expo.dev/build-reference/app-versions/).

## One time EAS initialization

Use an authenticated Expo account that owns the project. In `apps/mobile`:

```powershell
pnpm exec eas build:version:set
```

Select Android and initialize it to the highest version code from Play Console. Do not initialize from the local `21` unless Play Console confirms that `21` is the high-water mark. Then confirm the remote value:

```powershell
pnpm exec eas build:version:get --platform android --profile production --json
```

If remote is below Play Console, do not build. Run the EAS version set command again with the verified Play Console value, then recheck. Never decrease EAS remote version state.

## Release helper

The centralized helper is `apps/mobile/scripts/android-release.cjs`, exposed through `pnpm --filter @vbo/mobile release:android`. `config` validates both local EAS configurations without contacting EAS; `check` and `prepare` additionally query EAS and compare it to the Play baseline:

```powershell
cd apps/mobile
pnpm release:android config
$env:ANDROID_PLAY_LAST_UPLOADED_VERSION_CODE = '<highest code in any Play track>'
pnpm release:android check
pnpm release:android prepare
pnpm release:android build
```

`check` and `prepare` are read-only. They check the application ID, semantic version, production signing source, local credentials-file presence, profile increment settings, authenticated EAS remote version, and the Play Console high-water mark. `build` repeats those checks, takes a same-machine production-build lock, and submits an Android production AAB build to EAS without auto-submit. EAS performs the remote auto-increment when a build is created; the helper never submits an artifact to Play.

Only launch Android builds through this helper. The local lock prevents two helper launches on the same workstation at once. All Android profiles share EAS's server-side project/platform version source; a `versionCode` is consumed at build creation and must be treated as burned even if the build is cancelled, fails, or is rejected by Play. Start another build to get the next value. Do not decrement or reuse the number.

After downloading the AAB from the EAS build page, validate its manifest and signature:

```powershell
$env:BUNDLETOOL_JAR = '<path to official bundletool-all.jar>'
pnpm release:android validate '<path to downloaded AAB>'
```

The validator checks that the AAB is signed, its package is `com.bizpro.vickins`, its `versionName` matches `app.json`, and its embedded `versionCode` exceeds `ANDROID_PLAY_LAST_UPLOADED_VERSION_CODE`. Compare the signing certificate fingerprint with the existing Play upload certificate before submission; signature presence alone does not prove key continuity.

## Concurrency and release tracks

EAS remote state provides the shared monotonically increasing sequence across the three Android profiles. Use the helper as the only release-build entry point, and do not run a second release lane from another machine while a production build is being prepared. The current repository has no central CI workflow with a cross-runner concurrency group; therefore this working tree has not verified two authenticated EAS build submissions from separate workers racing at once. Before enabling parallel release automation, configure a single CI release lane with a concurrency group keyed to the EAS project and Android platform, or obtain an EAS-supported reservation/serialization guarantee and verify it with authenticated concurrent builds. The local lock does not claim cross-host serialization.

## Local versus remote verification

Verified locally: EAS CLI `25.3.0` is installed and meets the configured `>=25.3.0` minimum; both EAS configs use remote versions; all Android-capable profiles auto-increment; package identity remains `com.bizpro.vickins`; production remains configured for local credentials; the Android debug Gradle build succeeds with package `com.bizpro.vickins`, code 21, and name 1.0.4; and the release helper passes JavaScript syntax/config parsing checks. The debug build emitted a nonfatal AGP 8.8.2 / compile SDK 36 compatibility warning.

Phase 6B remote snapshot (superseded by the Phase 6C reconciliation below): `eas build:version:get --platform android --profile production --json` returned Android remote versionCode **16**. A read-only `eas build:list` showed no new build from the interrupted preflight wrapper exercise; no remote code was consumed. EAS reported that it uses the native Android directory for `android.package`, so the helper also checks the Gradle `applicationId`, `versionName`, and release signing-config references.

At the Phase 6B snapshot, not verified: Play Console high-water mark, whether remote 16 was initialized at or above every Play track, an authenticated production AAB build, generated signed AAB version data, existing Play upload certificate fingerprint, or cross-host concurrent submission behavior. A previously staged workspace AAB was rejected by the helper because its embedded `versionName` is `0.1.0` while the current app config is `1.0.4`; it is not a release candidate. No Play submission or release upload was made in Phase 6B. Current version/artifact status is recorded in the Phase 6C follow-up.

## Phase 6C final reconciliation — 2026-11-01

**Overall decision: C. NOT READY FOR RELEASE. Play/EAS version reconciliation: PASS (owner-confirmed).** The owner confirmed that versionCode **21** is the highest code across Play tracks for `com.bizpro.vickins`. The initially reported Release name `21 (1.0.4)` was not treated as authoritative by itself: Google's documentation describes Release name as an editable, console-only label that is initially populated from the bundle's version name ([Play Console release guidance](https://support.google.com/googleplay/android-developer/answer/9859348?hl=en)). The confirmation is owner-provided; Play Console was not directly connected in this session.

The owner reports the latest production entry as **Release name: `21 (1.0.4)`, 35 hours ago**, and then confirmed that **21 is the highest version code across the tracks**. Record the origin as owner confirmation rather than a direct Play Console read.

The repository uses one remote EAS sequence, with Android `autoIncrement` in development, preview, and production. Expo documents that remote version values are authoritative and local app-config values are ignored/overwritten for EAS builds using that source ([Expo app version management](https://docs.expo.dev/build-reference/app-versions/)). `android.versionCode: 21` is a local/debug fallback, not a second incrementer. The release helper now checks both `eas.json` files, requires the remote source in both, verifies each Android profile has platform-level auto-increment, rejects profile-level competing `autoIncrement`, and requires matching CLI version constraints. `node --check apps/mobile/scripts/android-release.cjs` passed after this change.

The helper lock is **same-machine only**. No isolated EAS project or independent release runners were available, and no concurrent EAS allocation test was run. EAS configuration alone does not establish cross-host serialization. Keep concurrent production release jobs disabled until an isolated non-Play EAS project/test configuration demonstrates unique allocation from two independent runners, or one CI release lane serializes submissions. If EAS accepts a build and it later fails or is cancelled, do not reuse its assigned code; query the remote value again before another build.

The production EAS request failed during local project archiving before a build record or AAB was created; see the Phase 6C follow-up below. Android target SDK configuration is 36 in Expo build-properties, and the local debug build succeeds, but release build type, embedded target SDK, signed artifact, upload-key fingerprint continuity, and 16 KB page-size compatibility still require inspection of an actual production AAB. Do not infer these results from the debug APK. The local credentials source and keystore reference remain configured; this does not prove the key matches Play App Signing's accepted upload certificate.

Play/EAS version reconciliation is PASS (owner-confirmed 21; the latest verified EAS remote is 24 after failed/interrupted attempts). Remaining release requirements: retry only from a machine or temporary volume with sufficient disk space (next allocated code 25), inspect the resulting AAB, and compare its upload certificate SHA-256 fingerprint with Play Console. No Play upload is part of this gate.

## iOS status

iOS remains **BLOCKED / unverified**, independent of Android. The Windows host has no Xcode, and this phase did not attempt to simulate an Xcode build. From a macOS checkout with Xcode command-line tools, CocoaPods, Apple signing/provisioning access, a production EAS profile, and valid App Store Connect access, the cloud build command is:

```bash
cd apps/mobile
pnpm exec eas build --platform ios --profile production --non-interactive
```

For a local native Release build on macOS, use `pnpm exec expo run:ios --configuration Release` from `apps/mobile`; it requires Xcode, the iOS SDK, and CocoaPods. The archive still needs signing/provisioning validation and App Store Connect/TestFlight processing. No iOS archive, signing check, or App Store validation passed in this phase.

## Phase 6C owner confirmation and production build attempt — 2026-11-01

The owner confirmed that **21** is the highest Play version code across tracks. Read-only EAS version retrieval from `apps/mobile` initially returned **16**. `pnpm exec eas build:version:set --platform android --profile production` was then used to set the EAS remote baseline to **21**. A subsequent read-only `pnpm exec eas build:version:get --platform android --profile production --json` returned **21**, and with `ANDROID_PLAY_LAST_UPLOADED_VERSION_CODE=21`, `pnpm --filter @vbo/mobile release:android check` returned **PASS** for package `com.bizpro.vickins` and versionName `1.0.4`.

Three production-profile build attempts were made through `pnpm --filter @vbo/mobile release:android build`. Attempt 1 consumed code **22** and failed with `ENOSPC` while compressing the local archive. The root `.easignore` was updated to exclude generated `**/.cxx/` CMake caches (266 MB); these files were left in the workspace. Attempt 2 consumed **23** but again failed with `ENOSPC`. Attempt 3 consumed **24**; it was stopped when C: fell from about 3.12 GB free to about 46 MB, before archive upload. A read-only EAS version query returned **24**, and `eas build:list` showed no new build. Codes 22–24 are treated as consumed; the next EAS build will allocate **25**. The final read-only helper check was started but stopped after an unusually long remote query; a prior helper check passed with Play baseline 21 and EAS remote 22. No build ID or AAB exists, and no signing or artifact validation was possible. The interrupted attempt's generated EAS tarball, shallow clone, and stale local lock were removed only after confirming the helper process had stopped; this restored about 3.12 GB. No workspace files or CMake caches were deleted. Another build needs a machine or temporary volume with more free space. No Play upload occurred.
