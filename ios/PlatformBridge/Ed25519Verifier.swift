import CryptoKit
import Foundation

/// Doc 03 §3.4 — Ed25519 signature verification using CryptoKit exclusively (Prompt 1
/// §9.3: OS-provided cryptography only, no third-party crypto library). CryptoKit's
/// `Curve25519.Signing` API is Swift-only, so this small `@objc`-exposed wrapper is what
/// lets `ios/VersionCheck.mm` (Obj-C++) call into it via CocoaPods' auto-generated
/// `VersionCheck-Swift.h` header — a standard mixed-language-pod interop pattern that
/// requires no manual bridging header (bridging headers are only needed for an app
/// target calling into Swift; for a pod, `DEFINES_MODULE` + the generated `-Swift.h`
/// header handles it automatically once a Swift file is present in `s.source_files`).
@objc public class Ed25519Verifier: NSObject {
  @objc public static func verify(publicKey: Data, message: Data, signature: Data) -> Bool {
    guard let key = try? Curve25519.Signing.PublicKey(rawRepresentation: publicKey) else {
      return false
    }
    return key.isValidSignature(signature, for: message)
  }
}
