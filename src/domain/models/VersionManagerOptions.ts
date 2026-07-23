import type { IPlatformBridge } from '../ports/IPlatformBridge';
import type {
  SignatureAlgorithm,
  VersionManagerConfigDocument,
} from './ConfigDocument';
import type { RemoteVersionInfo } from './RemoteVersionInfo';

export type LogLevel =
  'silent' | 'error' | 'warn' | 'info' | 'debug' | 'verbose';

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ILogSink {
  write(entry: LogEntry): void;
}

export interface LoggingOptions {
  level?: LogLevel;
  sink?: ILogSink;
}

export interface CacheOptions {
  ttlMs?: number;
  storage?: 'memory' | 'persistent';
  bustOnManualCheck?: boolean;
}

export interface RetryOptions {
  maxAttempts?: number;
  backoff?: 'fixed' | 'exponential-jitter';
  baseDelayMs?: number;
}

export interface FallbackOptions {
  onNetworkError?: 'useCache' | 'useDefaultConfig' | 'noAction';
  defaultConfig?: RemoteVersionInfo;
  requestTimeoutMs?: number;
  retry?: RetryOptions;
}

export interface StoreLinksOptions {
  /**
   * appStoreId is optional — when omitted, the App Store lookup falls back to the
   * running app's bundle id (IAppInfoProvider.getBundleId(), read at check time)
   * instead of the numeric App Store Connect id.
   */
  ios?: { appStoreId?: string; region?: string };
  /**
   * packageName is optional — when omitted, the Google Play lookup falls back to the
   * running app's bundle id (which *is* the Android package name) at check time.
   */
  android?: { packageName?: string };
  huawei?: { appId: string };
  amazon?: { asin: string };
  custom?: { url: string; headers?: Record<string, string> };
}

export interface PolicyOptions {
  forceUpdateBelow?: string;
  reminderIntervalMs?: number;
  rolloutPercentage?: number;
}

/** Doc 03 §1.1 Security field group — fixed by the app developer, tier-4 only. */
export interface SecurityOptions {
  signatureAlgorithm?: SignatureAlgorithm;
  trustedKeyIds?: string[];
}

/**
 * Doc 03 §0/§4 — optional loadable-config-document extension points layered on top of
 * the VersionManagerOptions "default fallback" tier. All optional; an app that supplies
 * none of these still works, driven entirely by configure() options (tier 4 only).
 */
export interface ConfigSourcesOptions {
  /**
   * Bundled local config envelope. Metro/webpack natively supports JSON imports
   * (`import localConfig from './vm-config.json'`), which already avoids the
   * double-buffer-copy §5.1 is concerned about for a <=64KB document without requiring
   * a dedicated native mmap reader — pass the imported envelope object directly.
   */
  local?: import('./ConfigDocument').SignedConfigEnvelope;
  /** Extra headers/timeout for the remote fetch beyond FallbackOptions.requestTimeoutMs. */
  remoteFetchHeaders?: Record<string, string>;
  /** Explicit runtime overrides — highest-precedence tier (§4.2 tier 1). */
  envOverrides?: Partial<VersionManagerConfigDocument>;
  /** Registered customUiHookIds -> handler ids that a config document is allowed to activate (§1.2, §7.1 VM-1009). */
  registeredUiHookIds?: string[];
}

export interface VersionManagerOptions {
  appVersion?: string;
  logging?: LoggingOptions;
  cache?: CacheOptions;
  fallback?: FallbackOptions;
  stores: StoreLinksOptions;
  policy?: PolicyOptions;
  /** DI override, advanced/testing use only (Prompt 2 §1.1). */
  platformBridge?: IPlatformBridge;
  strictReadiness?: boolean;
  /** Doc 03 §1.1 — if absent, the SDK operates in local-file/default-only mode. */
  remoteConfigUrl?: string;
  security?: SecurityOptions;
  configSources?: ConfigSourcesOptions;
}

/**
 * Fully-defaulted, immutable configuration actually consumed at runtime, produced by
 * IConfigProvider.resolve() from a VersionManagerOptions "default fallback" tier
 * (Prompt 3 §4.2). Local-file/remote/env overlay tiers are extension points on
 * IConfigProvider, not yet wired into a signed-envelope pipeline in this pass —
 * see docs/architecture/03-configuration-system.md §3 for that follow-up scope.
 */
export interface ResolvedVersionManagerConfig {
  readonly appVersion: string | null;
  readonly logging: { readonly level: LogLevel; readonly sink: ILogSink };
  readonly cache: {
    readonly ttlMs: number;
    readonly storage: 'memory' | 'persistent';
    readonly bustOnManualCheck: boolean;
  };
  readonly fallback: {
    readonly onNetworkError: 'useCache' | 'useDefaultConfig' | 'noAction';
    readonly defaultConfig: RemoteVersionInfo | null;
    readonly requestTimeoutMs: number;
    readonly retry: {
      readonly maxAttempts: number;
      readonly backoff: 'fixed' | 'exponential-jitter';
      readonly baseDelayMs: number;
    };
  };
  readonly stores: StoreLinksOptions;
  readonly policy: {
    readonly forceUpdateBelow: string | null;
    readonly reminderIntervalMs: number;
    readonly rolloutPercentage: number;
  };
  readonly strictReadiness: boolean;
  readonly remoteConfigUrl: string | null;
  readonly security: {
    readonly signatureAlgorithm: SignatureAlgorithm;
    readonly trustedKeyIds: readonly string[];
  };
  readonly schemaVersion: string;
}
