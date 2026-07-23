package com.rsnativekit.versioncheck

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.util.Base64
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import java.security.Signature
import java.util.Locale
import java.util.concurrent.TimeUnit
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

class VersionCheckModule(reactContext: ReactApplicationContext) :
  NativeVersionCheckSpec(reactContext) {

  private val prefs: SharedPreferences by lazy {
    reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
  }
  private val securePrefs: SharedPreferences by lazy {
    reactApplicationContext.getSharedPreferences(SECURE_PREFS_NAME, Context.MODE_PRIVATE)
  }

  // --- App info ---

  override fun getCurrentAppVersion(promise: Promise) {
    try {
      val info = reactApplicationContext.packageManager.getPackageInfo(reactApplicationContext.packageName, 0)
      promise.resolve(info.versionName ?: "")
    } catch (error: Exception) {
      promise.reject("get_current_app_version_failed", error)
    }
  }

  override fun getBuildNumber(promise: Promise) {
    try {
      val info = reactApplicationContext.packageManager.getPackageInfo(reactApplicationContext.packageName, 0)
      val code = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()
      promise.resolve(code.toString())
    } catch (error: Exception) {
      promise.reject("get_build_number_failed", error)
    }
  }

  override fun getBundleId(promise: Promise) {
    promise.resolve(reactApplicationContext.packageName)
  }

  // --- Device info ---

  override fun getOsVersion(promise: Promise) {
    promise.resolve(Build.VERSION.RELEASE ?: Build.VERSION.SDK_INT.toString())
  }

  override fun getDeviceModel(promise: Promise) {
    promise.resolve("${Build.MANUFACTURER} ${Build.MODEL}")
  }

  override fun getLocale(promise: Promise) {
    promise.resolve(Locale.getDefault().toLanguageTag())
  }

  // --- Key-value storage (SharedPreferences) ---

  override fun storageGet(key: String, promise: Promise) {
    promise.resolve(prefs.getString(key, null))
  }

  override fun storageSet(key: String, value: String, promise: Promise) {
    prefs.edit().putString(key, value).apply()
    promise.resolve(null)
  }

  override fun storageRemove(key: String, promise: Promise) {
    prefs.edit().remove(key).apply()
    promise.resolve(null)
  }

  // --- Secure storage (Keystore-backed AES/GCM over SharedPreferences) ---

  override fun secureStorageGet(key: String, promise: Promise) {
    try {
      val stored = securePrefs.getString(key, null)
      if (stored == null) {
        promise.resolve(null)
      } else {
        promise.resolve(SecureStorageCipher.decrypt(stored))
      }
    } catch (error: Exception) {
      promise.reject("secure_storage_get_failed", error)
    }
  }

  override fun secureStorageSet(key: String, value: String, promise: Promise) {
    try {
      securePrefs.edit().putString(key, SecureStorageCipher.encrypt(value)).apply()
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("secure_storage_set_failed", error)
    }
  }

  override fun secureStorageRemove(key: String, promise: Promise) {
    securePrefs.edit().remove(key).apply()
    promise.resolve(null)
  }

  // --- Signature verification (doc 03 §3.4) ---
  //
  // Trusted key material is embedded at build time via a Gradle-injected BuildConfig
  // field (TRUSTED_SIGNING_KEYS_JSON, a JSON object mapping keyId -> base64 key
  // material) rather than shipped from JS, per §3.4's "embedded at build time, not
  // hardcoded in the JS bundle" requirement. Host apps supply this via
  // `android.defaultConfig.buildConfigField "String", "TRUSTED_SIGNING_KEYS_JSON", "..."`
  // in their own build.gradle; if absent, verification fails closed (returns false)
  // rather than silently trusting an unverifiable document.

  private fun resolveKeyMaterial(keyId: String): ByteArray? {
    return try {
      val field = Class.forName("${reactApplicationContext.packageName}.BuildConfig")
        .getField("TRUSTED_SIGNING_KEYS_JSON")
      val json = org.json.JSONObject(field.get(null) as String)
      if (!json.has(keyId)) null else Base64.decode(json.getString(keyId), Base64.NO_WRAP)
    } catch (error: Exception) {
      null
    }
  }

  override fun verifyEd25519(keyId: String, messageBase64: String, signatureBase64: String, promise: Promise) {
    try {
      val keyMaterial = resolveKeyMaterial(keyId)
      if (keyMaterial == null) {
        promise.resolve(false)
        return
      }
      // Ed25519 via java.security requires API 33+ (Conscrypt) on stock Android; on
      // older API levels this throws NoSuchAlgorithmException and verification fails
      // closed rather than silently succeeding — documented platform-version gap.
      val keySpec = java.security.spec.X509EncodedKeySpec(keyMaterial)
      val keyFactory = java.security.KeyFactory.getInstance("Ed25519")
      val publicKey = keyFactory.generatePublic(keySpec)
      val signature = Signature.getInstance("Ed25519")
      signature.initVerify(publicKey)
      signature.update(Base64.decode(messageBase64, Base64.NO_WRAP))
      promise.resolve(signature.verify(Base64.decode(signatureBase64, Base64.NO_WRAP)))
    } catch (error: Exception) {
      promise.reject("verify_ed25519_failed", error)
    }
  }

  override fun verifyHmacSha256(keyId: String, messageBase64: String, macBase64: String, promise: Promise) {
    try {
      val keyMaterial = resolveKeyMaterial(keyId)
      if (keyMaterial == null) {
        promise.resolve(false)
        return
      }
      val mac = Mac.getInstance("HmacSHA256")
      mac.init(SecretKeySpec(keyMaterial, "HmacSHA256"))
      val computed = mac.doFinal(Base64.decode(messageBase64, Base64.NO_WRAP))
      val expected = Base64.decode(macBase64, Base64.NO_WRAP)
      promise.resolve(constantTimeEquals(computed, expected))
    } catch (error: Exception) {
      promise.reject("verify_hmac_sha256_failed", error)
    }
  }

  private fun constantTimeEquals(a: ByteArray, b: ByteArray): Boolean {
    if (a.size != b.size) return false
    var diff = 0
    for (i in a.indices) diff = diff or (a[i].toInt() xor b[i].toInt())
    return diff == 0
  }

  // --- Background scheduling (doc 01 §4.1 "scheduler" row) ---
  //
  // WorkManager PeriodicWorkRequest, minimum periodic interval is 15 minutes (an
  // OS-enforced floor on Android, not a choice of this library); requests below that
  // are rounded up. VersionCheckWorker wakes VersionCheckHeadlessTaskService, which
  // runs the "VersionCheckBackgroundTask" headless JS task the host app must register
  // (see registerVersionCheckHeadlessTask() in the JS public API).

  override fun scheduleBackgroundCheck(taskId: String, minIntervalMs: Double, promise: Promise) {
    try {
      val intervalMinutes = maxOf(15L, (minIntervalMs / 60_000.0).toLong())
      val request = PeriodicWorkRequestBuilder<VersionCheckWorker>(intervalMinutes, TimeUnit.MINUTES)
        .addTag(taskId)
        .build()
      WorkManager.getInstance(reactApplicationContext)
        .enqueueUniquePeriodicWork(taskId, ExistingPeriodicWorkPolicy.UPDATE, request)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("schedule_background_check_failed", error)
    }
  }

  override fun cancelBackgroundCheck(taskId: String, promise: Promise) {
    try {
      WorkManager.getInstance(reactApplicationContext).cancelUniqueWork(taskId)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("cancel_background_check_failed", error)
    }
  }

  companion object {
    const val NAME = NativeVersionCheckSpec.NAME
    private const val PREFS_NAME = "rs_version_check_prefs"
    private const val SECURE_PREFS_NAME = "rs_version_check_secure_prefs"
  }
}
