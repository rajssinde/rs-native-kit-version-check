package com.rsnativekit.versioncheck

import com.facebook.react.bridge.ReactApplicationContext

class VersionCheckModule(reactContext: ReactApplicationContext) :
  NativeVersionCheckSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeVersionCheckSpec.NAME
  }
}
