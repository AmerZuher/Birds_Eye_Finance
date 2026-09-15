// Local Expo config plugin: release APK output for GitHub Releases.
//
// `android/` is generated (and gitignored), so anything hand-edited there is
// wiped by `expo prebuild --clean` — which is exactly how the original
// build.gradle edit for this was lost. Living here, it's re-applied on every
// prebuild instead. See docs/DEVELOPMENT.md → Release builds.
//
// After `assembleRelease` (also what `npx expo run:android --variant release`
// runs), copies the release APK to <project>/apk/birdsEyeFinance_V<versionName>.apk.
// The build output itself keeps Android's default name so `expo run:android`
// can still find and install it.
const { withAppBuildGradle } = require('expo/config-plugins');

const TAG = 'birdseye-release-apk';

const GRADLE_BLOCK = `
// @generated begin ${TAG} — from plugins/withReleaseApk.js; edit there, not here.
tasks.register("copyReleaseApkToRoot", Copy) {
    def versionName = android.defaultConfig.versionName
    from(layout.buildDirectory.dir("outputs/apk/release")) {
        include "app-release.apk"
        rename { "birdsEyeFinance_V\${versionName}.apk" }
    }
    into(rootProject.file("../apk"))
}

tasks.configureEach { task ->
    if (task.name == "assembleRelease") {
        task.finalizedBy("copyReleaseApkToRoot")
    }
}
// @generated end ${TAG}
`;

module.exports = function withReleaseApk(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withReleaseApk: expected android/app/build.gradle to be Groovy.');
    }
    if (!cfg.modResults.contents.includes(`@generated begin ${TAG}`)) {
      cfg.modResults.contents = `${cfg.modResults.contents.trimEnd()}\n${GRADLE_BLOCK}`;
    }
    return cfg;
  });
};
