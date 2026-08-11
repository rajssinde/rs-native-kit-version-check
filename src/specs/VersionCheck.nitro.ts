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
 * `scheduleBackgroundCheck`/`cancelBackgroundCheck` (doc 04 §2) wrap WorkManager on
 * Android and BGTaskScheduler on iOS — see the Hybrid* implementations. `taskId` is used
 * as the WorkManager unique-work name/tag on Android; iOS's BGTaskScheduler API only
 * supports one registered identifier per task (declared in Info.plist), so `taskId` is
 * accepted for signature symmetry but not otherwise used there.
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

  /** Doc 04 §2 — see the module-level doc comment above for `taskId` semantics per platform. */
  scheduleBackgroundCheck(taskId: string, minIntervalMs: number): Promise<void>;
  cancelBackgroundCheck(taskId: string): Promise<void>;

  /**
   * Doc 04 §1 — native in-app update integrations. Android wraps Play Core's
   * AppUpdateManager (Flexible/Immediate flows); iOS has no equivalent in-process API
   * (Apple exposes no "is an update staged" signal at all), so there this always
   * resolves 'unavailable' — treat that as "fall back to storeUrl", not as a real
   * availability check, on iOS specifically.
   */
  checkInAppUpdateAvailability(): Promise<string>; // 'unavailable' | 'available' | 'inProgress'
  /**
   * `flow` is 'flexible' | 'immediate' (Android only — iOS has no such distinction and
   * ignores it). `storeUrl` is the current UpdateInfo.storeUrl; Android ignores it too
   * (Play Core resolves the update for the installed app package on its own) — iOS uses
   * it to build an `itms-apps://` deep link (a modal App Store overlay instead of fully
   * backgrounding to the App Store app), since there's no native SDK there.
   */
  startInAppUpdate(flow: string, storeUrl: string): Promise<void>;
  /** Android-only — triggers the install after a Flexible download finishes. No-op on iOS. */
  completeFlexibleUpdate(): Promise<void>;
}
