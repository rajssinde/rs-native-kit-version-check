import type { PlatformId } from '../models/PlatformId';
import type { Unsubscribe } from '../models/Unsubscribe';
import type { IClock } from './IClock';
import type { IInAppUpdateProvider } from './IInAppUpdateProvider';

export type { Unsubscribe };

export interface HttpRequest {
  readonly url: string;
  readonly method: 'GET' | 'POST';
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeoutMs: number;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export interface IHttpClient {
  request(req: HttpRequest): Promise<HttpResponse>;
}

export interface IKeyValueStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface ISecureStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface IAppInfoProvider {
  getCurrentVersion(): Promise<string>;
  getBuildNumber(): Promise<string>;
  getBundleId(): Promise<string>;
}

export interface IDeviceInfoProvider {
  getOsVersion(): Promise<string>;
  getDeviceModel(): Promise<string>;
  getLocale(): Promise<string>;
}

export interface BackgroundTaskDescriptor {
  readonly taskId: string;
  readonly minIntervalMs: number;
}

/**
 * `onFire` (doc 04 §2) only ever runs on platforms where a scheduled task can re-enter
 * *this same* JS runtime instance (Web: a foreground setInterval poll). Native
 * (WorkManager/BGTaskScheduler) implementations accept and ignore it — their re-entry
 * point is a fresh JS context via a headless task / launch handler, never an in-process
 * callback, so there is nothing to invoke here.
 */
export interface IBackgroundScheduler {
  schedule(task: BackgroundTaskDescriptor, onFire?: () => void): Promise<void>;
  cancel(taskId: string): Promise<void>;
}

export interface IAppLifecycleObserver {
  onForeground(cb: () => void): Unsubscribe;
  onBackground(cb: () => void): Unsubscribe;
}

/**
 * Additive port (not in doc 01 §4's original table) backing ISignatureVerifier
 * (doc 03 §3.4): "OS-provided cryptography exclusively." Optional because it is only
 * required when a consumer configures remote/local signed config documents with
 * algorithm !== 'none'. `keyId` (not raw key material) crosses the JS/native boundary —
 * per doc 03 §3.4 the actual public key / HMAC secret is embedded at build time on the
 * native side (iOS Info.plist/Secrets.xcconfig, Android BuildConfig) and resolved from
 * `keyId` inside the native implementation; JS never sees key material.
 */
export interface ICryptoProvider {
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

export interface IPlatformBridge {
  readonly platform: PlatformId;
  readonly http: IHttpClient;
  readonly storage: IKeyValueStorage;
  readonly secureStorage: ISecureStorage;
  readonly appInfo: IAppInfoProvider;
  readonly deviceInfo: IDeviceInfoProvider;
  readonly scheduler: IBackgroundScheduler;
  readonly clock: IClock;
  readonly lifecycle: IAppLifecycleObserver;
  readonly crypto?: ICryptoProvider;
  /** Doc 04 §1 — optional: Web has no equivalent capability and genuinely omits this field (unlike `crypto?`, which every current target populates). */
  readonly inAppUpdate?: IInAppUpdateProvider;
}
