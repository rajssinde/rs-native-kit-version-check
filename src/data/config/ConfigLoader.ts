import type { ConfigLoadRequest } from '../../domain/models/ConfigDocument';
import type { IConfigProvider } from '../../domain/ports/IConfigProvider';
import type { Unsubscribe } from '../../domain/models/Unsubscribe';
import type {
  ResolvedVersionManagerConfig,
  VersionManagerOptions,
} from '../../domain/models/VersionManagerOptions';
import { ConsoleLogSink } from '../../shared/logging/Logger';
import type { ConfigResolutionPipeline } from './ConfigResolutionPipeline';
import { validateOptions } from './ConfigValidator';

/**
 * Synchronous default-merge (doc 03 §4.2 tier 4 only). Kept as a plain function, not
 * just a method on ConfigLoader, so the DI composition root (src/di/container.ts) can
 * validate + resolve synchronously at configure()-time (doc 02 §1.3's fail-fast
 * requirement) without awaiting a Promise, and so ConfigResolutionPipeline can call it
 * as its always-valid tier-4 floor (doc 03 §7.2's termination guarantee).
 */
export function resolveConfigSync(
  defaults: VersionManagerOptions
): ResolvedVersionManagerConfig {
  validateOptions(defaults);

  return {
    appVersion: defaults.appVersion ?? null,
    logging: {
      level: defaults.logging?.level ?? 'warn',
      sink: defaults.logging?.sink ?? new ConsoleLogSink(),
    },
    cache: {
      ttlMs: defaults.cache?.ttlMs ?? 21_600_000,
      storage: defaults.cache?.storage ?? 'persistent',
      bustOnManualCheck: defaults.cache?.bustOnManualCheck ?? true,
    },
    fallback: {
      onNetworkError: defaults.fallback?.onNetworkError ?? 'useCache',
      defaultConfig: defaults.fallback?.defaultConfig ?? null,
      requestTimeoutMs: defaults.fallback?.requestTimeoutMs ?? 8_000,
      retry: {
        maxAttempts: defaults.fallback?.retry?.maxAttempts ?? 3,
        backoff: defaults.fallback?.retry?.backoff ?? 'exponential-jitter',
        baseDelayMs: defaults.fallback?.retry?.baseDelayMs ?? 500,
      },
    },
    stores: defaults.stores,
    backgroundCheck: {
      enabled: defaults.backgroundCheck?.enabled ?? false,
      minIntervalMs:
        defaults.backgroundCheck?.minIntervalMs ??
        defaults.cache?.ttlMs ??
        21_600_000,
    },
    policy: {
      forceUpdateBelow: defaults.policy?.forceUpdateBelow ?? null,
      reminderIntervalMs: defaults.policy?.reminderIntervalMs ?? 259_200_000,
      rolloutPercentage: defaults.policy?.rolloutPercentage ?? 100,
      channel: defaults.policy?.channel ?? null,
      rules: defaults.policy?.rules ?? [],
    },
    strictReadiness: defaults.strictReadiness ?? false,
    remoteConfigUrl: defaults.remoteConfigUrl ?? null,
    security: {
      signatureAlgorithm: defaults.security?.signatureAlgorithm ?? 'none',
      trustedKeyIds: defaults.security?.trustedKeyIds ?? [],
    },
    schemaVersion: '1.0',
  };
}

/**
 * Doc 03 §0's IConfigProvider implementation — thin wrapper around
 * ConfigResolutionPipeline that adds change-detection so subscribe() only fires when a
 * later resolution actually differs from the last one (§4.4 hot-update contract).
 */
export class ConfigLoader implements IConfigProvider {
  private readonly listeners = new Set<
    (config: ResolvedVersionManagerConfig) => void
  >();
  private lastResolved: ResolvedVersionManagerConfig | null = null;

  constructor(private readonly pipeline?: ConfigResolutionPipeline) {}

  async resolve(
    defaults: VersionManagerOptions
  ): Promise<ResolvedVersionManagerConfig> {
    const config = this.pipeline
      ? (await this.pipeline.resolve(defaults)).config
      : resolveConfigSync(defaults);

    const changed =
      this.lastResolved !== null &&
      JSON.stringify(this.lastResolved) !== JSON.stringify(config);
    this.lastResolved = config;
    if (changed) {
      for (const listener of Array.from(this.listeners)) listener(config);
    }
    return config;
  }

  async load(
    request: ConfigLoadRequest
  ): Promise<ResolvedVersionManagerConfig> {
    return this.resolve(request.defaults);
  }

  subscribe(
    listener: (config: ResolvedVersionManagerConfig) => void
  ): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
