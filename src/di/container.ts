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
import { AmazonAppstoreProvider } from '../data/providers/amazon/AmazonAppstoreProvider';
import { CustomApiProvider } from '../data/providers/custom-api/CustomApiProvider';
import { FirebaseRemoteConfigProvider } from '../data/providers/firebase-remote-config/FirebaseRemoteConfigProvider';
import { GooglePlayProvider } from '../data/providers/google-play/GooglePlayProvider';
import { HuaweiAppGalleryProvider } from '../data/providers/huawei/HuaweiAppGalleryProvider';
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
 * port and its concrete adapter simultaneously. See doc 05 for the Huawei/Amazon/
 * Firebase Remote Config design: Huawei/Amazon are gated to `bridge.platform ===
 * 'android'` (alternative Android app stores), Firebase Remote Config is platform-
 * agnostic and registered whenever configured. Huawei additionally requires a
 * consumer-supplied access token (static or callback) — without one it can't
 * authenticate against AGC, so it's silently skipped, same as any other unconfigured
 * store.
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
      new GooglePlayProvider(
        bridge.http,
        config.stores.android.packageName,
        config.stores.android.region
      )
    );
  }
  if (bridge.platform === 'android' && config.stores.huawei) {
    const { appId, accessToken, getAccessToken, clientId } =
      config.stores.huawei;
    const resolveToken =
      getAccessToken ?? (accessToken ? () => accessToken : undefined);
    if (resolveToken) {
      providers.push(
        new HuaweiAppGalleryProvider(bridge.http, appId, resolveToken, clientId)
      );
    }
  }
  if (bridge.platform === 'android' && config.stores.amazon) {
    providers.push(
      new AmazonAppstoreProvider(bridge.http, config.stores.amazon.asin)
    );
  }
  if (config.stores.firebaseRemoteConfig) {
    providers.push(
      new FirebaseRemoteConfigProvider(
        bridge.http,
        bridge.platform,
        config.stores.firebaseRemoteConfig
      )
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
