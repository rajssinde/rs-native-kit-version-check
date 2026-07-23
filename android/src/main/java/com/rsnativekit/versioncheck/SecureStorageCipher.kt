package com.rsnativekit.versioncheck

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * AES/GCM encryption backed by the Android Keystore — java.security/javax.crypto only,
 * no external Gradle dependency (docs/architecture/03-configuration-system.md §3.4).
 * The key is generated inside the keystore and never leaves it; only ciphertext + IV
 * are persisted in SharedPreferences by the caller.
 */
internal object SecureStorageCipher {
  private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
  private const val KEY_ALIAS = "rs_version_check_secure_storage_key"
  private const val TRANSFORMATION = "AES/GCM/NoPadding"
  private const val GCM_TAG_LENGTH_BITS = 128

  private fun getOrCreateKey(): SecretKey {
    val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
    (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

    val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
    val spec =
      KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .build()
    keyGenerator.init(spec)
    return keyGenerator.generateKey()
  }

  fun encrypt(plainText: String): String {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
    val cipherBytes = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
    val iv = Base64.encodeToString(cipher.iv, Base64.NO_WRAP)
    val payload = Base64.encodeToString(cipherBytes, Base64.NO_WRAP)
    return "$iv:$payload"
  }

  fun decrypt(stored: String): String {
    val parts = stored.split(":", limit = 2)
    require(parts.size == 2) { "Malformed secure storage entry" }
    val iv = Base64.decode(parts[0], Base64.NO_WRAP)
    val cipherBytes = Base64.decode(parts[1], Base64.NO_WRAP)

    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv))
    return String(cipher.doFinal(cipherBytes), Charsets.UTF_8)
  }
}
