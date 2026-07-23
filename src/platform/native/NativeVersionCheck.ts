import { TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * TurboModule Codegen spec. Deliberately small: HTTP (global `fetch`), the clock
 * (`Date.now()`), and app-lifecycle (`AppState`) are already available in pure JS via
 * React Native itself and do not need a custom native surface (Prompt 1 §4.1 revised
 * during implementation — the design doc's per-target table listed a native `http`
 * bridge conceptually, but RN's own Networking module already satisfies IHttpClient
 * without new native code). What genuinely requires native code — reading the app's
 * own version/bundle id and persisting key-value pairs via UserDefaults/Keychain or
 * SharedPreferences/Keystore — is exactly what's declared here.
 */
export interface Spec extends TurboModule {
  getCurrentAppVersion(): Promise<string>;
  getBuildNumber(): Promise<string>;
  getBundleId(): Promise<string>;
  getOsVersion(): Promise<string>;
  getDeviceModel(): Promise<string>;
  getLocale(): Promise<string>;

  storageGet(key: string): Promise<string | null>;
  storageSet(key: string, value: string): Promise<void>;
  storageRemove(key: string): Promise<void>;

  secureStorageGet(key: string): Promise<string | null>;
  secureStorageSet(key: string, value: string): Promise<void>;
  secureStorageRemove(key: string): Promise<void>;

  /**
   * Doc 03 §3.4 — signature verification over OS-provided cryptography. `keyId` is
   * resolved to build-time-embedded key material natively (Info.plist/BuildConfig);
   * only the keyId, not the key itself, crosses this bridge. Android implements both
   * via java.security/javax.crypto; iOS implements HMAC-SHA256 via CommonCrypto and
   * Ed25519 via a small CryptoKit-backed Swift wrapper (ios/PlatformBridge/Ed25519Verifier.swift).
   */
  verifyEd25519(
    keyId: string,
    messageBase64: string,
    signatureBase64: string
  ): Promise<boolean>;
  verifyHmacSha256(
    keyId: string,
    messageBase64: string,
    macBase64: string
  ): Promise<boolean>;
}

let cachedModule: Spec | null = null;

/**
 * Lazily resolved rather than the usual top-level
 * `TurboModuleRegistry.getEnforcing<Spec>(...)` pattern, so importing this module (or
 * anything that transitively imports it, e.g. src/di/container.ts) never throws in
 * environments where the native module isn't registered — Jest's simulated native
 * platform resolution, or a caller who supplies VersionManagerOptions.platformBridge
 * and therefore never actually needs it. The registry lookup only happens the first
 * time a method is actually called.
 */
export default function getNativeVersionCheck(): Spec {
  if (!cachedModule) {
    cachedModule = TurboModuleRegistry.getEnforcing<Spec>('VersionCheck');
  }
  return cachedModule;
}
