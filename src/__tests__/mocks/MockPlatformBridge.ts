import type { PlatformId } from '../../domain/models/PlatformId';
import type { IClock } from '../../domain/ports/IClock';
import type {
  BackgroundTaskDescriptor,
  HttpRequest,
  HttpResponse,
  IAppInfoProvider,
  IAppLifecycleObserver,
  IBackgroundScheduler,
  IDeviceInfoProvider,
  IHttpClient,
  IKeyValueStorage,
  IPlatformBridge,
  ISecureStorage,
  Unsubscribe,
} from '../../domain/ports/IPlatformBridge';
import { MockClock } from './MockClock';

export type HttpRequestHandler = (
  req: HttpRequest
) => Promise<HttpResponse> | HttpResponse;

export interface MockPlatformBridgeOptions {
  platform?: PlatformId;
  clock?: IClock;
  currentVersion?: string;
  buildNumber?: string;
  bundleId?: string;
  httpHandler?: HttpRequestHandler;
}

/** Deterministic HTTP/storage/clock without a real device or browser (Prompt 1 §11.1). */
export class MockPlatformBridge implements IPlatformBridge {
  readonly platform: PlatformId;
  readonly clock: IClock;
  readonly storage: IKeyValueStorage;
  readonly secureStorage: ISecureStorage;
  readonly http: IHttpClient;
  readonly appInfo: IAppInfoProvider;
  readonly deviceInfo: IDeviceInfoProvider;
  readonly scheduler: IBackgroundScheduler;
  readonly lifecycle: IAppLifecycleObserver;

  /** Test spies for scheduler wiring (doc 04 §2) — recorded, not part of IBackgroundScheduler itself. */
  readonly scheduledTasks: BackgroundTaskDescriptor[] = [];
  readonly canceledTaskIds: string[] = [];
  private lastOnFire: (() => void) | undefined;

  private httpHandler: HttpRequestHandler;

  constructor(options: MockPlatformBridgeOptions = {}) {
    this.platform = options.platform ?? 'ios';
    this.clock = options.clock ?? new MockClock();

    const storageMap = new Map<string, string>();
    this.storage = {
      async get(key: string) {
        return storageMap.get(key) ?? null;
      },
      async set(key: string, value: string) {
        storageMap.set(key, value);
      },
      async remove(key: string) {
        storageMap.delete(key);
      },
    };

    const secureStorageMap = new Map<string, string>();
    this.secureStorage = {
      async getItem(key: string) {
        return secureStorageMap.get(key) ?? null;
      },
      async setItem(key: string, value: string) {
        secureStorageMap.set(key, value);
      },
      async removeItem(key: string) {
        secureStorageMap.delete(key);
      },
    };

    this.httpHandler =
      options.httpHandler ??
      ((): HttpResponse => ({ status: 200, headers: {}, body: '{}' }));
    this.http = {
      request: (req: HttpRequest) => Promise.resolve(this.httpHandler(req)),
    };

    const currentVersion = options.currentVersion ?? '1.0.0';
    const buildNumber = options.buildNumber ?? '1';
    const bundleId = options.bundleId ?? 'com.example.app';
    this.appInfo = {
      async getCurrentVersion() {
        return currentVersion;
      },
      async getBuildNumber() {
        return buildNumber;
      },
      async getBundleId() {
        return bundleId;
      },
    };

    this.deviceInfo = {
      async getOsVersion() {
        return '17.0';
      },
      async getDeviceModel() {
        return 'MockDevice';
      },
      async getLocale() {
        return 'en-US';
      },
    };

    this.scheduler = {
      schedule: async (task: BackgroundTaskDescriptor, onFire?: () => void) => {
        this.scheduledTasks.push(task);
        this.lastOnFire = onFire;
      },
      cancel: async (taskId: string) => {
        this.canceledTaskIds.push(taskId);
      },
    };

    this.lifecycle = {
      onForeground(_cb: () => void): Unsubscribe {
        return () => {};
      },
      onBackground(_cb: () => void): Unsubscribe {
        return () => {};
      },
    };
  }

  setHttpHandler(handler: HttpRequestHandler): void {
    this.httpHandler = handler;
  }

  /** Fires the onFire callback passed to the most recent scheduler.schedule() call. */
  fireScheduledTask(): void {
    this.lastOnFire?.();
  }
}
