import { AppState, Platform } from 'react-native';
import {
  OfflineException,
  RequestTimeoutException,
} from '../../domain/errors/VersionManagerException';
import type { PlatformId } from '../../domain/models/PlatformId';
import type {
  BackgroundTaskDescriptor,
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
} from '../../domain/ports/IPlatformBridge';
import NativeVersionCheck from './NativeVersionCheck';

class RnHttpClient implements IHttpClient {
  async request(req: HttpRequest): Promise<HttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), req.timeoutMs);
    try {
      const response = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
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

class RnKeyValueStorage implements IKeyValueStorage {
  async get(key: string): Promise<string | null> {
    return NativeVersionCheck().storageGet(key);
  }
  async set(key: string, value: string): Promise<void> {
    await NativeVersionCheck().storageSet(key, value);
  }
  async remove(key: string): Promise<void> {
    await NativeVersionCheck().storageRemove(key);
  }
}

class RnSecureStorage implements ISecureStorage {
  async getItem(key: string): Promise<string | null> {
    return NativeVersionCheck().secureStorageGet(key);
  }
  async setItem(key: string, value: string): Promise<void> {
    await NativeVersionCheck().secureStorageSet(key, value);
  }
  async removeItem(key: string): Promise<void> {
    await NativeVersionCheck().secureStorageRemove(key);
  }
}

class RnAppInfoProvider implements IAppInfoProvider {
  async getCurrentVersion(): Promise<string> {
    return NativeVersionCheck().getCurrentAppVersion();
  }
  async getBuildNumber(): Promise<string> {
    return NativeVersionCheck().getBuildNumber();
  }
  async getBundleId(): Promise<string> {
    return NativeVersionCheck().getBundleId();
  }
}

class RnDeviceInfoProvider implements IDeviceInfoProvider {
  async getOsVersion(): Promise<string> {
    return NativeVersionCheck().getOsVersion();
  }
  async getDeviceModel(): Promise<string> {
    return NativeVersionCheck().getDeviceModel();
  }
  async getLocale(): Promise<string> {
    return NativeVersionCheck().getLocale();
  }
}

/**
 * True OS-scheduled background execution (BGTaskScheduler/WorkManager, Prompt 26) is
 * not implemented in this pass. schedule()/cancel() log a warning rather than silently
 * pretending to work — see the equivalent, identically-scoped note on WebBackgroundScheduler.
 */
class RnBackgroundScheduler implements IBackgroundScheduler {
  async schedule(task: BackgroundTaskDescriptor): Promise<void> {
    console.warn(
      `[VersionManager] Background scheduling ("${task.taskId}") is not implemented on ${Platform.OS} yet (Prompt 26).`
    );
  }
  async cancel(_taskId: string): Promise<void> {
    // no-op — nothing was ever scheduled, see schedule() above.
  }
}

class RnAppLifecycleObserver implements IAppLifecycleObserver {
  onForeground(cb: () => void): Unsubscribe {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') cb();
    });
    return () => sub.remove();
  }

  onBackground(cb: () => void): Unsubscribe {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') cb();
    });
    return () => sub.remove();
  }
}

/**
 * Doc 03 §3.4 — delegates to the native TurboModule, which resolves `keyId` to
 * build-time-embedded key material (iOS CommonCrypto/CryptoKit, Android
 * java.security/javax.crypto) and never exposes key material to JS.
 */
class RnCryptoProvider implements ICryptoProvider {
  async verifyEd25519(
    keyId: string,
    messageBase64: string,
    signatureBase64: string
  ): Promise<boolean> {
    return NativeVersionCheck().verifyEd25519(
      keyId,
      messageBase64,
      signatureBase64
    );
  }
  async verifyHmacSha256(
    keyId: string,
    messageBase64: string,
    macBase64: string
  ): Promise<boolean> {
    return NativeVersionCheck().verifyHmacSha256(
      keyId,
      messageBase64,
      macBase64
    );
  }
}

export class NativePlatformBridge implements IPlatformBridge {
  readonly platform: PlatformId = Platform.OS === 'ios' ? 'ios' : 'android';
  readonly http: IHttpClient = new RnHttpClient();
  readonly storage: IKeyValueStorage = new RnKeyValueStorage();
  readonly secureStorage: ISecureStorage = new RnSecureStorage();
  readonly appInfo: IAppInfoProvider = new RnAppInfoProvider();
  readonly deviceInfo: IDeviceInfoProvider = new RnDeviceInfoProvider();
  readonly scheduler: IBackgroundScheduler = new RnBackgroundScheduler();
  readonly clock = { now: (): number => Date.now() };
  readonly lifecycle: IAppLifecycleObserver = new RnAppLifecycleObserver();
  readonly crypto: ICryptoProvider = new RnCryptoProvider();
}
