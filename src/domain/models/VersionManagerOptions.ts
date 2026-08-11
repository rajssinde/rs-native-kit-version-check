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
   * region is optional — when omitted, the listing URL carries no `gl=` param and Play
   * resolves storefront region from the request's own signals (e.g. IP), same as today.
   */
  android?: { packageName?: string; region?: string };
  /**
   * Huawei AppGallery has no unauthenticated lookup API — the public listing page is a
   * client-rendered SPA with no version data in the raw HTTP response, so a Google-Play-
   * style scrape isn't viable. Instead this calls Huawei's AGC "App Info Query" Open API,
   * authenticated with a bearer token the *consumer's own backend* obtains via Huawei's
   * OAuth client_id/secret flow — this library never holds Huawei OAuth credentials, the
   * same trust boundary as pointing `custom` at your own endpoint. Provide either a
   * pre-fetched `accessToken` or a `getAccessToken` callback (preferred for tokens that
   * expire); without one of the two, the Huawei provider is not registered at all.
   * These three fields are configure()-time-only — a function can't cross a signed
   * remote-config JSON document, and a bearer token should never ship inside one either,
   * so they are intentionally not part of the remote ConfigDocument schema.
   */
  huawei?: {
    appId: string;
    accessToken?: string;
    getAccessToken?: () => string | Promise<string>;
    clientId?: string;
  };
  /**
   * Amazon Appstore has no official lookup API and its public listing page does not
   * reliably expose a machine-parseable version field (weaker signal than Google Play's
   * embedded JSON) — AmazonAppstoreProvider is a best-effort HTML scrape; consumers
   * needing reliability should prefer `custom` pointed at their own endpoint instead.
   */
  amazon?: { asin: string };
  custom?: { url: string; headers?: Record<string, string> };
  /**
   * Fetches `parameterKey` (default `'latest_version'`) from a Firebase Remote Config
   * project via plain REST — the same calls the native Firebase SDK makes internally
   * (Installations API for an instance token, then Remote Config's `:fetch` endpoint),
   * done over the existing IHttpClient port with no Firebase SDK dependency. This is a
   * reverse-engineered/unofficial contract, not a documented public API — treat it with
   * the same "may change without notice" caution as the Google Play scrape.
   */
  firebaseRemoteConfig?: {
    apiKey: string;
    projectId: string;
    appId: string;
    parameterKey?: string;
    storeUrlParameterKey?: string;
    releaseNotesParameterKey?: string;
    minimumOsVersionParameterKey?: string;
  };
}

/**
 * Doc 04 §2 — OS-scheduled periodic background checks (WorkManager/BGTaskScheduler).
 * minIntervalMs reuses the same "how often do we bother the network" question
 * CacheOptions.ttlMs already answers, so it defaults to cache.ttlMs rather than
 * introducing a second, separately-tuned interval. No effect on Web (no true background
 * execution there; see WebBackgroundScheduler's foreground-visibility fallback).
 */
export interface BackgroundCheckOptions {
  enabled?: boolean;
  minIntervalMs?: number;
}

/**
 * Doc 06 §3 — first-match-wins targeting, layered over the flat forceUpdateBelow/
 * rolloutPercentage fields. Every clause a rule specifies must match for that rule to
 * apply; an omitted clause matches anything. configure()-time only (tier 4) for now —
 * not yet part of the signed remote-config document schema (doc 03); see
 * docs/architecture/06-roadmap-native-lockout-ota-rollouts-ui-telemetry-cli.md §3 for
 * the open question on remote delivery of rules.
 */
export interface TargetingRule {
  /** Device OS version floor (e.g. '17.0') — matches when the device's OS version is >= this. Omit to match any OS version. */
  minOsVersion?: string;
  /** Exact match against PolicyOptions.channel (e.g. 'beta', 'alpha') — this library never infers a channel, you set it. Omit to match any channel. */
  channel?: string;
  forceUpdateBelow?: string;
  rolloutPercentage?: number;
}

export interface PolicyOptions {
  forceUpdateBelow?: string;
  reminderIntervalMs?: number;
  rolloutPercentage?: number;
  /** Doc 06 §3 — your own build channel/flavor (e.g. 'beta', 'alpha', 'prod'), matched against TargetingRule.channel. */
  channel?: string;
  /** Doc 06 §3 — evaluated in order, first match wins; falls back to forceUpdateBelow/rolloutPercentage above when no rule matches (or none are configured). */
  rules?: readonly TargetingRule[];
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
  backgroundCheck?: BackgroundCheckOptions;
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
  readonly backgroundCheck: {
    readonly enabled: boolean;
    readonly minIntervalMs: number;
  };
  readonly policy: {
    readonly forceUpdateBelow: string | null;
    readonly reminderIntervalMs: number;
    readonly rolloutPercentage: number;
    readonly channel: string | null;
    readonly rules: readonly TargetingRule[];
  };
  readonly strictReadiness: boolean;
  readonly remoteConfigUrl: string | null;
  readonly security: {
    readonly signatureAlgorithm: SignatureAlgorithm;
    readonly trustedKeyIds: readonly string[];
  };
  readonly schemaVersion: string;
}
