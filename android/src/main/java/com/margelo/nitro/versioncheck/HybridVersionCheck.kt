package com.margelo.nitro.versioncheck

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.util.Base64
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.NullType
import com.margelo.nitro.core.Promise
import com.rsnativekit.versioncheck.SecureStorageCipher
import com.rsnativekit.versioncheck.VersionCheckWorker
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.util.Locale
import java.util.concurrent.TimeUnit
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

class HybridVersionCheck : HybridVersionCheckSpec() {

  private val context: Context
    get() = NitroModules.applicationContext
      ?: throw IllegalStateException("NitroModules.applicationContext is not available yet")

  private val prefs: SharedPreferences by lazy {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
  }
  private val securePrefs: SharedPreferences by lazy {
    context.getSharedPreferences(SECURE_PREFS_NAME, Context.MODE_PRIVATE)
  }

  // --- App info ---

  override fun getCurrentAppVersion(): Promise<String> = Promise.async {
    val info = context.packageManager.getPackageInfo(context.packageName, 0)
    info.versionName ?: ""
  }

  override fun getBuildNumber(): Promise<String> = Promise.async {
    val info = context.packageManager.getPackageInfo(context.packageName, 0)
    val code = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()
    code.toString()
  }

  override fun getBundleId(): Promise<String> = Promise.async {
    context.packageName
  }

  // --- Device info ---

  override fun getOsVersion(): Promise<String> = Promise.async {
    Build.VERSION.RELEASE ?: Build.VERSION.SDK_INT.toString()
  }

  override fun getDeviceModel(): Promise<String> = Promise.async {
    "${Build.MANUFACTURER} ${Build.MODEL}"
  }

  override fun getLocale(): Promise<String> = Promise.async {
    Locale.getDefault().toLanguageTag()
  }

  // --- Key-value storage (SharedPreferences) ---

  override fun storageGet(key: String): Promise<Variant_NullType_String> = Promise.async {
    val value = prefs.getString(key, null)
    if (value == null) Variant_NullType_String.create(NullType.NULL) else Variant_NullType_String.create(value)
  }

  override fun storageSet(key: String, value: String): Promise<Unit> = Promise.async {
    prefs.edit().putString(key, value).apply()
  }

  override fun storageRemove(key: String): Promise<Unit> = Promise.async {
    prefs.edit().remove(key).apply()
  }

  // --- Secure storage (Keystore-backed AES/GCM over SharedPreferences) ---

  override fun secureStorageGet(key: String): Promise<Variant_NullType_String> = Promise.async {
    val stored = securePrefs.getString(key, null)
    if (stored == null) {
      Variant_NullType_String.create(NullType.NULL)
    } else {
      Variant_NullType_String.create(SecureStorageCipher.decrypt(stored))
    }
  }

  override fun secureStorageSet(key: String, value: String): Promise<Unit> = Promise.async {
    securePrefs.edit().putString(key, SecureStorageCipher.encrypt(value)).apply()
  }

  override fun secureStorageRemove(key: String): Promise<Unit> = Promise.async {
    securePrefs.edit().remove(key).apply()
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
      val field = Class.forName("${context.packageName}.BuildConfig")
        .getField("TRUSTED_SIGNING_KEYS_JSON")
      val json = org.json.JSONObject(field.get(null) as String)
      if (!json.has(keyId)) null else Base64.decode(json.getString(keyId), Base64.NO_WRAP)
    } catch (error: Exception) {
      null
    }
  }

  override fun verifyEd25519(keyId: String, messageBase64: String, signatureBase64: String): Promise<Boolean> =
    Promise.async {
      val keyMaterial = resolveKeyMaterial(keyId)
      if (keyMaterial == null) {
        false
      } else {
        // Ed25519 via java.security requires API 33+ (Conscrypt) on stock Android; on
        // older API levels this throws NoSuchAlgorithmException and verification fails
        // closed rather than silently succeeding — documented platform-version gap.
        val keySpec = X509EncodedKeySpec(keyMaterial)
        val keyFactory = KeyFactory.getInstance("Ed25519")
        val publicKey = keyFactory.generatePublic(keySpec)
        val signature = Signature.getInstance("Ed25519")
        signature.initVerify(publicKey)
        signature.update(Base64.decode(messageBase64, Base64.NO_WRAP))
        signature.verify(Base64.decode(signatureBase64, Base64.NO_WRAP))
      }
    }

  override fun verifyHmacSha256(keyId: String, messageBase64: String, macBase64: String): Promise<Boolean> =
    Promise.async {
      val keyMaterial = resolveKeyMaterial(keyId)
      if (keyMaterial == null) {
        false
      } else {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(keyMaterial, "HmacSHA256"))
        val computed = mac.doFinal(Base64.decode(messageBase64, Base64.NO_WRAP))
        val expected = Base64.decode(macBase64, Base64.NO_WRAP)
        constantTimeEquals(computed, expected)
      }
    }

  private fun constantTimeEquals(a: ByteArray, b: ByteArray): Boolean {
    if (a.size != b.size) return false
    var diff = 0
    for (i in a.indices) diff = diff or (a[i].toInt() xor b[i].toInt())
    return diff == 0
  }

  // --- Background scheduling (doc 01 §4.1 "scheduler" row, doc 04 §2) ---
  //
  // WorkManager PeriodicWorkRequest, minimum periodic interval is 15 minutes (an
  // OS-enforced floor on Android, not a choice of this library); requests below that
  // are rounded up. VersionCheckWorker wakes VersionCheckHeadlessTaskService, which
  // runs the "VersionCheckBackgroundTask" headless JS task the host app must register
  // via registerVersionCheckHeadlessTask() (exported from '@rs-native-kit/version-check/background').

  override fun scheduleBackgroundCheck(taskId: String, minIntervalMs: Double): Promise<Unit> = Promise.async {
    val intervalMinutes = maxOf(15L, (minIntervalMs / 60_000.0).toLong())
    val request = PeriodicWorkRequestBuilder<VersionCheckWorker>(intervalMinutes, TimeUnit.MINUTES)
      .addTag(taskId)
      .build()
    WorkManager.getInstance(context)
      .enqueueUniquePeriodicWork(taskId, ExistingPeriodicWorkPolicy.UPDATE, request)
  }

  override fun cancelBackgroundCheck(taskId: String): Promise<Unit> = Promise.async {
    WorkManager.getInstance(context).cancelUniqueWork(taskId)
  }

  companion object {
    private const val PREFS_NAME = "rs_version_check_prefs"
    private const val SECURE_PREFS_NAME = "rs_version_check_secure_prefs"
  }
}
