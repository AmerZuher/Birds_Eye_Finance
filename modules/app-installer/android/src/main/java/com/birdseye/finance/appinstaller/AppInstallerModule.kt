package com.birdseye.finance.appinstaller

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AppInstallerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AppInstaller")
  }
}
