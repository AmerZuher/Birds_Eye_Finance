import { registerWebModule, NativeModule } from 'expo';

import type { ApkInfo } from './AppInstaller.types';

const ANDROID_ONLY = 'Installing an update is Android-only.';

/** Installing an APK has no meaning on the web; every call fails loudly except the permission check. */
class AppInstallerModule extends NativeModule<Record<string, never>> {
  async sha256(): Promise<string> {
    throw new Error(ANDROID_ONLY);
  }

  async inspectApk(): Promise<ApkInfo> {
    throw new Error(ANDROID_ONLY);
  }

  canInstallPackages(): boolean {
    return false;
  }

  async openInstallPermissionSettings(): Promise<void> {
    throw new Error(ANDROID_ONLY);
  }

  async installApk(): Promise<void> {
    throw new Error(ANDROID_ONLY);
  }
}

export default registerWebModule(AppInstallerModule, 'AppInstallerModule');
