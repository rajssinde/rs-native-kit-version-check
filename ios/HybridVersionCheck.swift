import BackgroundTasks
import CryptoKit
import Foundation
import NitroModules
import Security
import UIKit

private let kVersionCheckKeychainService = "com.rsnativekit.versioncheck"
private let kVersionCheckBGTaskIdentifier = "com.rsnativekit.versioncheck.refresh"

class HybridVersionCheck: HybridVersionCheckSpec {

  // MARK: - App info

  func getCurrentAppVersion() throws -> Promise<String> {
    return Promise.async {
      Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
    }
  }

  func getBuildNumber() throws -> Promise<String> {
    return Promise.async {
      Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""
    }
  }

  func getBundleId() throws -> Promise<String> {
    return Promise.async {
      Bundle.main.bundleIdentifier ?? ""
    }
  }

  // MARK: - Device info

  func getOsVersion() throws -> Promise<String> {
    return Promise.async {
      await UIDevice.current.systemVersion
    }
  }

  func getDeviceModel() throws -> Promise<String> {
    return Promise.async {
      var systemInfo = utsname()
      uname(&systemInfo)
      let identifier = withUnsafePointer(to: &systemInfo.machine) {
        $0.withMemoryRebound(to: CChar.self, capacity: 1) { ptr in
          String(cString: ptr)
        }
      }
      return identifier
    }
  }

  func getLocale() throws -> Promise<String> {
    return Promise.async {
      Locale.current.identifier
    }
  }

  // MARK: - Key-value storage (UserDefaults)

  func storageGet(key: String) throws -> Promise<Variant_NullType_String> {
    return Promise.async {
      guard let value = UserDefaults.standard.string(forKey: key) else {
        return .first(.null)
      }
      return .second(value)
    }
  }

  func storageSet(key: String, value: String) throws -> Promise<Void> {
    return Promise.async {
      UserDefaults.standard.set(value, forKey: key)
    }
  }

  func storageRemove(key: String) throws -> Promise<Void> {
    return Promise.async {
      UserDefaults.standard.removeObject(forKey: key)
    }
  }

  // MARK: - Secure storage (Keychain)

  private func keychainQuery(forKey key: String) -> [String: Any] {
    return [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: kVersionCheckKeychainService,
      kSecAttrAccount as String: key,
    ]
  }

  func secureStorageGet(key: String) throws -> Promise<Variant_NullType_String> {
    return Promise.async {
      var query = self.keychainQuery(forKey: key)
      query[kSecReturnData as String] = true
      query[kSecMatchLimit as String] = kSecMatchLimitOne

      var result: CFTypeRef?
      let status = SecItemCopyMatching(query as CFDictionary, &result)
      switch status {
      case errSecSuccess:
        guard let data = result as? Data, let value = String(data: data, encoding: .utf8) else {
          return .first(.null)
        }
        return .second(value)
      case errSecItemNotFound:
        return .first(.null)
      default:
        throw RuntimeError("Keychain read failed (status \(status))")
      }
    }
  }

  func secureStorageSet(key: String, value: String) throws -> Promise<Void> {
    return Promise.async {
      guard let data = value.data(using: .utf8) else {
        throw RuntimeError("Failed to encode value for Keychain write")
      }
      var query = self.keychainQuery(forKey: key)
      // Overwrite semantics: delete any existing item before adding, since SecItemUpdate
      // requires a separate attributes dictionary and delete+add is simpler/safer here.
      SecItemDelete(query as CFDictionary)
      query[kSecValueData as String] = data
      query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock

      let status = SecItemAdd(query as CFDictionary, nil)
      guard status == errSecSuccess else {
        throw RuntimeError("Keychain write failed (status \(status))")
      }
    }
  }

  func secureStorageRemove(key: String) throws -> Promise<Void> {
    return Promise.async {
      SecItemDelete(self.keychainQuery(forKey: key) as CFDictionary)
    }
  }

  // MARK: - Signature verification (doc 03 §3.4)

  // Trusted key material is embedded at build time via Info.plist ("VMTrustedSigningKeys",
  // a dictionary mapping keyId -> base64 key material) rather than shipped from JS, per
  // §3.4's "embedded at build time, not hardcoded in the JS bundle" requirement. Host apps
  // add this key to their own Info.plist; if absent, verification fails closed.
  private func resolveKeyMaterial(_ keyId: String) -> Data? {
    guard
      let keys = Bundle.main.object(forInfoDictionaryKey: "VMTrustedSigningKeys") as? [String: String],
      let base64 = keys[keyId]
    else { return nil }
    return Data(base64Encoded: base64)
  }

  func verifyEd25519(keyId: String, messageBase64: String, signatureBase64: String) throws -> Promise<Bool> {
    return Promise.async {
      guard
        let keyMaterial = self.resolveKeyMaterial(keyId),
        let message = Data(base64Encoded: messageBase64),
        let signature = Data(base64Encoded: signatureBase64),
        let publicKey = try? Curve25519.Signing.PublicKey(rawRepresentation: keyMaterial)
      else {
        return false
      }
      return publicKey.isValidSignature(signature, for: message)
    }
  }

  func verifyHmacSha256(keyId: String, messageBase64: String, macBase64: String) throws -> Promise<Bool> {
    return Promise.async {
      guard
        let keyMaterial = self.resolveKeyMaterial(keyId),
        let message = Data(base64Encoded: messageBase64),
        let expectedMac = Data(base64Encoded: macBase64)
      else {
        return false
      }
      let computed = Data(HMAC<SHA256>.authenticationCode(for: message, using: SymmetricKey(data: keyMaterial)))
      guard computed.count == expectedMac.count else { return false }
      // Constant-time comparison.
      var diff: UInt8 = 0
      for (a, b) in zip(computed, expectedMac) {
        diff |= a ^ b
      }
      return diff == 0
    }
  }

  // MARK: - Background scheduling (doc 01 §4.1 "scheduler" row, doc 04 §2)

  // BGTaskScheduler requires the host app to declare the task identifier in Info.plist
  // (`BGTaskSchedulerPermittedIdentifiers`) and enable the "Background Modes > Background
  // processing" capability, plus register a launch handler for
  // kVersionCheckBGTaskIdentifier (typically in AppDelegate via
  // `BGTaskScheduler.shared.register(forTaskWithIdentifier:using:launchHandler:)`) — none
  // of which this library can inject into a consumer's app itself. Unlike Android's
  // WorkManager, BGTaskScheduler has no headless-JS-task equivalent driven from this
  // package; the host app's launch handler is native code that boots the RN bridge and
  // calls checkForUpdates() itself.
  func scheduleBackgroundCheck(taskId: String, minIntervalMs: Double) throws -> Promise<Void> {
    return Promise.async {
      let request = BGAppRefreshTaskRequest(identifier: kVersionCheckBGTaskIdentifier)
      request.earliestBeginDate = Date(timeIntervalSinceNow: minIntervalMs / 1000.0)
      do {
        try BGTaskScheduler.shared.submit(request)
      } catch {
        throw RuntimeError(
          "BGTaskScheduler submission failed — verify BGTaskSchedulerPermittedIdentifiers in Info.plist: \(error.localizedDescription)"
        )
      }
    }
  }

  func cancelBackgroundCheck(taskId: String) throws -> Promise<Void> {
    return Promise.async {
      BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: kVersionCheckBGTaskIdentifier)
    }
  }

  // MARK: - In-app update (doc 04 §1)

  // Apple exposes no "is an update staged" API — always 'unavailable', meaning callers
  // should fall back to storeUrl rather than treat this as a real availability check.
  func checkInAppUpdateAvailability() throws -> Promise<String> {
    return Promise.async {
      "unavailable"
    }
  }

  // No native in-process update flow on iOS; open an itms-apps:// deep link (a modal
  // App Store overlay) instead. `flow` is Android-only and ignored here.
  func startInAppUpdate(flow: String, storeUrl: String) throws -> Promise<Void> {
    return Promise.async {
      guard let url = URL(string: storeUrl) else {
        throw RuntimeError("Invalid storeUrl for in-app update: \(storeUrl)")
      }
      await UIApplication.shared.open(url)
    }
  }

  // Android-only (Play Core Flexible flow) — no-op on iOS.
  func completeFlexibleUpdate() throws -> Promise<Void> {
    return Promise.async {}
  }
}
