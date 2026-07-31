package com.rsnativekit.versioncheck

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Exports no native modules — HybridVersionCheck registers itself via JNI in
 * VersionCheckOnLoad.cpp (Nitro's HybridObject registry), not through this ReactPackage.
 * This class exists solely so RN's classic Android autolinking, which requires finding a
 * *Package.{java,kt} class implementing ReactPackage to link this Gradle module and merge
 * AndroidManifest.xml, can discover this library (see @react-native-community/cli-config-android
 * findPackageClassName). Without it, `dependencyConfig()` returns null and the app's
 * settings.gradle never includes this project.
 */
class VersionCheckPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? = null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider { emptyMap() }
}