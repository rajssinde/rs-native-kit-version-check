import { PersistentCacheStore } from '../data/cache/PersistentCacheStore';
import { MemoryCacheStore } from '../data/cache/MemoryCacheStore';
import { ConfigCache } from '../data/config/ConfigCache';
import { ConfigDocumentValidator } from '../data/config/ConfigDocumentValidator';
import { resolveConfigSync } from '../data/config/ConfigLoader';
import { ConfigProvider } from '../data/config/ConfigProvider';
import { SignatureVerifier } from '../data/config/SignatureVerifier';
import { EnvironmentOverrideSource } from '../data/config/sources/EnvironmentOverrideSource';
import { LocalConfigSource } from '../data/config/sources/LocalConfigSource';
import { RemoteConfigSource } from '../data/config/sources/RemoteConfigSource';
import { AppleStoreProvider } from '../data/providers/apple/AppleStoreProvider';
import { CustomApiProvider } from '../data/providers/custom-api/CustomApiProvider';
import { GooglePlayProvider } from '../data/providers/google-play/GooglePlayProvider';
import { VersionRepositoryImpl } from '../data/repositories/VersionRepositoryImpl';
import { DecisionEngine } from '../domain/engines/decision/DecisionEngine';
import { PolicyEngine } from '../domain/engines/policy/PolicyEngine';
import { SemVerEngine } from '../domain/engines/semver/SemVerEngine';
import type { VersionManagerEventMap } from '../domain/models/Events';
import type { RemoteVersionInfo } from '../domain/models/RemoteVersionInfo';
import type {
  ResolvedVersionManagerConfig,
  VersionManagerOptions,
} from '../domain/models/VersionManagerOptions';
import type { IPlatformBridge } from '../domain/ports/IPlatformBridge';
import type { IStoreProvider } from '../domain/ports/IStoreProvider';
import { VersionManagerCore } from '../domain/VersionManagerCore';
import type { IVersionManagerCore } from '../domain/IVersionManagerCore';
import { createPlatformBridge } from '../platform/createPlatformBridge';
import { EventBus } from '../shared/eventbus/EventBus';

/**
 * Composition root (Prompt 1 §1.3) — the only file in the codebase that imports both a
 * port and its concrete adapter simultaneously. Only Apple/Google Play/Custom API
 * providers are wired here; Huawei/Amazon/Firebase Remote Config providers exist as
 * independently importable files (Prompt 1 §8) but are intentionally not referenced
 * from this file yet since their implementations are still stubs (see those files'
 * doc comments) — wiring them here would defeat tree-shaking for no behavioral benefit.
 */
export function createVersionManagerCore(
  options: VersionManagerOptions
): IVersionManagerCore {
  // Synchronous — throws InvalidConfigException immediately for a bad options bag
  // (Prompt 2 §1.3's fail-fast requirement), before any adapter is constructed.
  const config: ResolvedVersionManagerConfig = resolveConfigSync(options);

  const platformBridge: IPlatformBridge =
    options.platformBridge ?? createPlatformBridge();
  const clock = platformBridge.clock;
  const comparator = new SemVerEngine();
  const policyEngine = new PolicyEngine(comparator);
  const decisionEngine = new DecisionEngine(clock);
  const eventBus = new EventBus<VersionManagerEventMap>();

  const providers = buildProviders(config, platformBridge);
  const remoteInfoCache =
    config.cache.storage === 'memory'
      ? new MemoryCacheStore<RemoteVersionInfo>(clock, config.cache.ttlMs)
      : new PersistentCacheStore<RemoteVersionInfo>(
          platformBridge.storage,
          clock,
          config.cache.ttlMs
        );

  const repository = new VersionRepositoryImpl(
    providers,
    remoteInfoCache,
    platformBridge.storage,
    clock
  );

  const configProvider = new ConfigProvider({
    local: new LocalConfigSource(options.configSources?.local),
    remote: new RemoteConfigSource(platformBridge.http),
    envOverrides: new EnvironmentOverrideSource(
      options.configSources?.envOverrides
    ),
    cache: new ConfigCache(platformBridge.storage),
    validator: new ConfigDocumentValidator(),
    signatureVerifier: new SignatureVerifier(platformBridge.crypto),
    clock,
  });

  return new VersionManagerCore({
    config,
    rawOptions: options,
    platformBridge,
    repository,
    comparator,
    policyEngine,
    decisionEngine,
    eventBus,
    clock,
    configProvider,
  });
}

function buildProviders(
  config: ResolvedVersionManagerConfig,
  bridge: IPlatformBridge
): IStoreProvider[] {
  const providers: IStoreProvider[] = [];

  if (bridge.platform === 'ios' && config.stores.ios) {
    providers.push(
      new AppleStoreProvider(
        bridge.http,
        config.stores.ios.appStoreId,
        config.stores.ios.region
      )
    );
  }
  if (bridge.platform === 'android' && config.stores.android) {
    providers.push(
      new GooglePlayProvider(bridge.http, config.stores.android.packageName)
    );
  }
  if (config.stores.custom) {
    providers.push(
      new CustomApiProvider(
        bridge.http,
        config.stores.custom.url,
        config.stores.custom.headers
      )
    );
  }

  return providers;
}
