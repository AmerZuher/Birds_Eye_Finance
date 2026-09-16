import { NativeModule, requireNativeModule } from 'expo';

declare class AppInstallerModule extends NativeModule<{}> {}

export default requireNativeModule<AppInstallerModule>('AppInstaller');
