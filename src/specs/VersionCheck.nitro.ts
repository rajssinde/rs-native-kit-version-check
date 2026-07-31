import type { HybridObject } from 'react-native-nitro-modules';

/**
 * Nitro Module spec. Deliberately small: HTTP (global `fetch`), the clock (`Date.now()`),
 * and app-lifecycle (`AppState`) are already available in pure JS via React Native itself
 * and do not need a custom native surface (Prompt 1 §4.1 revised during implementation —
 * the design doc's per-target table listed a native `http` bridge conceptually, but RN's
 * own Networking module already satisfies IHttpClient without new native code). What
 * genuinely requires native code — reading the app's own version/bundle id and persisting
 * key-value pairs via UserDefaults/Keychain or SharedPreferences/Keystore — is exactly
 * what's declared here.
 *
 * `scheduleBackgroundCheck`/`cancelBackgroundCheck` are implemented natively (WorkManager
 * on Android, BGTaskScheduler on iOS — see the Hybrid* implementations) but intentionally
 * aren't part of this spec, matching the pre-existing TurboModule Spec this replaces:
 * `RnBackgroundScheduler` (src/platform/native/NativePlatformBridge.ts) is still a JS-side
 * no-op pending full background-check wiring (Prompt 26).
 */
export interface VersionCheck extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
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
   * via java.security/javax.crypto; iOS implements HMAC-SHA256 and Ed25519 via CryptoKit.
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
