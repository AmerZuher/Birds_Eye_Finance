import { NativeModule, requireNativeModule } from 'expo';

import type { ApkInfo } from './AppInstaller.types';

declare class AppInstallerModule extends NativeModule<Record<string, never>> {
  /** Lowercase hex SHA-256 of the file, streamed — safe for a large APK. */
  sha256(path: string): Promise<string>;
  /** The file's package, versionCode and signing certificates, beside the installed app's. */
  inspectApk(path: string): Promise<ApkInfo>;
  /** False until the user allows "install unknown apps" for this app (Android 8+). */
  canInstallPackages(): boolean;
  /** Opens the system page where that permission is granted. */
  openInstallPermissionSettings(): Promise<void>;
  /** Hands the APK to Android. On success the app is replaced and this process ends. */
  installApk(path: string): Promise<void>;
}

export default requireNativeModule<AppInstallerModule>('AppInstaller');
