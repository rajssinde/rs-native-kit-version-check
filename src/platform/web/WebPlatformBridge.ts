import {
  OfflineException,
  RequestTimeoutException,
} from '../../domain/errors/VersionManagerException';
import type { PlatformId } from '../../domain/models/PlatformId';
import type {
  HttpRequest,
  HttpResponse,
  IAppInfoProvider,
  IAppLifecycleObserver,
  IBackgroundScheduler,
  ICryptoProvider,
  IDeviceInfoProvider,
  IHttpClient,
  IKeyValueStorage,
  IPlatformBridge,
  ISecureStorage,
  Unsubscribe,
  BackgroundTaskDescriptor,
} from '../../domain/ports/IPlatformBridge';

/**
 * This project's tsconfig deliberately omits the "DOM" lib (it collides with React
 * Native's own global fetch/console typings — Prompt 1 constraint). The small subset
 * of browser globals this bridge needs is declared locally instead of pulling in the
 * full lib.dom.d.ts surface, and accessed through a single typed cast of globalThis.
 */
interface WebFetchResponseLike {
  readonly status: number;
  readonly headers: { forEach(cb: (value: string, key: string) => void): void };
  text(): Promise<string>;
}
type WebFetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: unknown;
};
type WebFetchLike = (
  url: string,
  init?: WebFetchInit
) => Promise<WebFetchResponseLike>;

interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface WebNavigatorLike {
  readonly language: string;
  readonly userAgent: string;
}

interface WebDocumentLike {
  readonly visibilityState: string;
  addEventListener(type: string, cb: () => void): void;
  removeEventListener(type: string, cb: () => void): void;
}

interface WebAbortControllerLike {
  readonly signal: unknown;
  abort(): void;
}

interface WebSubtleCryptoLike {
  importKey(
    format: string,
    keyData: unknown,
    algorithm: unknown,
    extractable: boolean,
    keyUsages: string[]
  ): Promise<unknown>;
  verify(
    algorithm: unknown,
    key: unknown,
    signature: unknown,
    data: unknown
  ): Promise<boolean>;
  sign(algorithm: unknown, key: unknown, data: unknown): Promise<unknown>;
}

interface WebGlobals {
  fetch: WebFetchLike;
  localStorage: WebStorageLike;
  navigator: WebNavigatorLike;
  document: WebDocumentLike;
  AbortController: new () => WebAbortControllerLike;
  crypto?: { subtle: WebSubtleCryptoLike };
  window?: {
    addEventListener(type: string, cb: () => void): void;
    removeEventListener(type: string, cb: () => void): void;
  };
  /**
   * Doc 03 §3.4's "embedded at build time" tier, for Web: since there is no OS
   * keychain/BuildConfig equivalent in a browser, the Web-target convention is a
   * build-time `define` (Vite/webpack) injecting this global with keyId -> base64 key
   * material — analogous to how §5.1 treats "Cache-Control: immutable" as the Web
   * equivalent of native mmap. Absent this global, ed25519/hmac-sha256 verification on
   * Web fails closed (returns false) rather than silently trusting an unverifiable doc.
   */
  __VM_TRUSTED_KEYS__?: Record<string, string>;
}

const webGlobal = globalThis as unknown as WebGlobals;

function base64ToBytes(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  throw new Error('No base64 decoder available in this environment');
}

/**
 * Doc 03 §3.4 crypto port, Web target — uses browser-native SubtleCrypto exclusively
 * (Prompt 1 §9.3: no third-party crypto library). HMAC-SHA256 has broad browser
 * support; Ed25519 support via WebCrypto is newer (Chrome 129+/Safari 17+) and this
 * method throws a clear, caught error on unsupported browsers rather than silently
 * failing — SignatureVerifier surfaces that as a normal SignatureVerificationException.
 */
class WebCryptoProvider implements ICryptoProvider {
  async verifyEd25519(
    keyId: string,
    messageBase64: string,
    signatureBase64: string
  ): Promise<boolean> {
    const subtle = webGlobal.crypto?.subtle;
    const keyMaterial = webGlobal.__VM_TRUSTED_KEYS__?.[keyId];
    if (!subtle || !keyMaterial) return false;
    const key = await subtle.importKey(
      'raw',
      base64ToBytes(keyMaterial),
      { name: 'Ed25519' },
      false,
      ['verify']
    );
    return subtle.verify(
      { name: 'Ed25519' },
      key,
      base64ToBytes(signatureBase64),
      base64ToBytes(messageBase64)
    );
  }

  async verifyHmacSha256(
    keyId: string,
    messageBase64: string,
    macBase64: string
  ): Promise<boolean> {
    const subtle = webGlobal.crypto?.subtle;
    const keyMaterial = webGlobal.__VM_TRUSTED_KEYS__?.[keyId];
    if (!subtle || !keyMaterial) return false;
    const key = await subtle.importKey(
      'raw',
      base64ToBytes(keyMaterial),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const computed = await subtle.sign(
      { name: 'HMAC' },
      key,
      base64ToBytes(messageBase64)
    );
    const computedBytes = new Uint8Array(computed as ArrayBuffer);
    const expectedBytes = base64ToBytes(macBase64);
    if (computedBytes.length !== expectedBytes.length) return false;
    let diff = 0;
    for (let i = 0; i < computedBytes.length; i++) {
      diff |= (computedBytes[i] as number) ^ (expectedBytes[i] as number);
    }
    return diff === 0;
  }
}

class WebHttpClient implements IHttpClient {
  async request(req: HttpRequest): Promise<HttpResponse> {
    const controller = new webGlobal.AbortController();
    const timeout = setTimeout(() => controller.abort(), req.timeoutMs);
    try {
      const response = await webGlobal.fetch(req.url, {
        method: req.method,
        headers: req.headers as Record<string, string> | undefined,
        body: req.body,
        signal: controller.signal,
      });
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      const body = await response.text();
      return { status: response.status, headers, body };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new RequestTimeoutException({
          message: `Request to "${req.url}" timed out after ${req.timeoutMs}ms`,
          cause: error,
        });
      }
      throw new OfflineException({
        message: `Request to "${req.url}" failed`,
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

class WebKeyValueStorage implements IKeyValueStorage {
  async get(key: string): Promise<string | null> {
    return webGlobal.localStorage.getItem(key);
  }
  async set(key: string, value: string): Promise<void> {
    webGlobal.localStorage.setItem(key, value);
  }
  async remove(key: string): Promise<void> {
    webGlobal.localStorage.removeItem(key);
  }
}

/**
 * Backed by localStorage under a distinct key prefix. This is functionally complete
 * (satisfies ISecureStorage) but is NOT encrypted at rest — true SubtleCrypto-based
 * encryption-at-rest for the Web target (Prompt 1 §4.1's documented design) is a
 * follow-up hardening item, not implemented in this pass.
 */
class WebSecureStorage implements ISecureStorage {
  private static readonly PREFIX = 'vm_secure_';
  async getItem(key: string): Promise<string | null> {
    return webGlobal.localStorage.getItem(WebSecureStorage.PREFIX + key);
  }
  async setItem(key: string, value: string): Promise<void> {
    webGlobal.localStorage.setItem(WebSecureStorage.PREFIX + key, value);
  }
  async removeItem(key: string): Promise<void> {
    webGlobal.localStorage.removeItem(WebSecureStorage.PREFIX + key);
  }
}

/**
 * The Web target has no OS bundle to read a version/build number from. These should be
 * injected at build time (e.g. a Vite `define`); absent that, callers are expected to
 * supply `VersionManagerOptions.appVersion` explicitly, which Core prefers over this
 * bridge (see VersionManagerCore.resolveCurrentVersion()).
 */
class WebAppInfoProvider implements IAppInfoProvider {
  async getCurrentVersion(): Promise<string> {
    return '0.0.0';
  }
  async getBuildNumber(): Promise<string> {
    return '0';
  }
  async getBundleId(): Promise<string> {
    return 'web';
  }
}

class WebDeviceInfoProvider implements IDeviceInfoProvider {
  async getOsVersion(): Promise<string> {
    return webGlobal.navigator.userAgent;
  }
  async getDeviceModel(): Promise<string> {
    return 'web';
  }
  async getLocale(): Promise<string> {
    return webGlobal.navigator.language;
  }
}

/**
 * True Service Worker `periodicSync` requires a registered service worker the host app
 * controls (feature-detected, narrow browser support) and is out of this pass's scope —
 * see the class-level fallback doc 01 §4.1 explicitly names: "visibility-change
 * fallback." This implements exactly that fallback for real: a `setInterval` gated so
 * the callback only actually fires while the tab is visible (`document.visibilityState
 * === 'visible'`), which is the best a page can do without its own registered SW.
 * `minIntervalMs` is honored as a floor, not a guarantee — like all browser timers, it
 * is throttled/paused while backgrounded, which is the whole reason for the visibility
 * gate (avoid firing a burst of missed intervals the instant the tab regains focus).
 */
class WebBackgroundScheduler implements IBackgroundScheduler {
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();

  async schedule(
    task: BackgroundTaskDescriptor,
    onFire?: () => void
  ): Promise<void> {
    this.cancelInternal(task.taskId);
    const timer = setInterval(() => {
      if (webGlobal.document.visibilityState !== 'visible') return;
      onFire?.();
    }, task.minIntervalMs);
    this.timers.set(task.taskId, timer);
  }

  async cancel(taskId: string): Promise<void> {
    this.cancelInternal(taskId);
  }

  private cancelInternal(taskId: string): void {
    const existing = this.timers.get(taskId);
    if (existing !== undefined) {
      clearInterval(existing);
      this.timers.delete(taskId);
    }
  }
}

class WebAppLifecycleObserver implements IAppLifecycleObserver {
  onForeground(cb: () => void): Unsubscribe {
    const handler = (): void => {
      if (webGlobal.document.visibilityState === 'visible') cb();
    };
    webGlobal.document.addEventListener('visibilitychange', handler);
    return () =>
      webGlobal.document.removeEventListener('visibilitychange', handler);
  }

  onBackground(cb: () => void): Unsubscribe {
    const handler = (): void => {
      if (webGlobal.document.visibilityState === 'hidden') cb();
    };
    webGlobal.document.addEventListener('visibilitychange', handler);
    return () =>
      webGlobal.document.removeEventListener('visibilitychange', handler);
  }
}

export class WebPlatformBridge implements IPlatformBridge {
  readonly platform: PlatformId = 'web';
  readonly http: IHttpClient = new WebHttpClient();
  readonly storage: IKeyValueStorage = new WebKeyValueStorage();
  readonly secureStorage: ISecureStorage = new WebSecureStorage();
  readonly appInfo: IAppInfoProvider = new WebAppInfoProvider();
  readonly deviceInfo: IDeviceInfoProvider = new WebDeviceInfoProvider();
  readonly scheduler: IBackgroundScheduler = new WebBackgroundScheduler();
  readonly clock = { now: (): number => Date.now() };
  readonly lifecycle: IAppLifecycleObserver = new WebAppLifecycleObserver();
  readonly crypto: ICryptoProvider = new WebCryptoProvider();
}
