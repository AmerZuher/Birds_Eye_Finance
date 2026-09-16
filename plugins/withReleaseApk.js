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
    def target = rootProject.file("../apk/birdsEyeFinance_V\${versionName}.apk")
    // Refuse to overwrite an APK that already exists: that means this version was already
    // built, which almost always means app.json's version wasn't bumped (CLAUDE.md rule 17).
    // Silently clobbering it once produced a "2.2.0" build stamped 2.1.0 that nearly went
    // out as a 2.1.0 re-upload.
    doFirst {
        if (target.exists()) {
            throw new GradleException(
                "Release build stopped: apk/birdsEyeFinance_V\${versionName}.apk already exists.\\n" +
                "Bump expo.version and expo.android.versionCode in app.json first (CLAUDE.md rule 17), " +
                "then re-run npm run release:android.\\n" +
                "If you really mean to rebuild \${versionName}, delete or rename that file."
            )
        }
    }
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
