/** What an APK file claims to be, next to the app that is actually installed (FEATURE_SPEC 3.2 C). */
export interface ApkInfo {
  packageName: string;
  versionCode: number;
  versionName: string | null;
  /** SHA-256 of each signing certificate in the file. */
  signatureSha256: string[];
  installedPackageName: string;
  installedVersionCode: number;
  /** SHA-256 of each signing certificate of the installed app. */
  installedSignatureSha256: string[];
}
