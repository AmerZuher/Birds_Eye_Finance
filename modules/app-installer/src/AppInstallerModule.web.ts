import { registerWebModule, NativeModule } from 'expo';

// AppInstallerModule is not available on the web platform.
class AppInstallerModule extends NativeModule<{}> {}

export default registerWebModule(AppInstallerModule, 'AppInstallerModule');
