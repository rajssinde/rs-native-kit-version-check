import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigProvider } from '../../data/config/ConfigProvider';
import { ConfigDocumentValidator } from '../../data/config/ConfigDocumentValidator';
import type {
  IConfigCache,
  IEnvironmentOverrideSource,
  ILocalConfigSource,
  IRemoteConfigSource,
  ISignatureVerifier,
} from '../../domain/ports/IConfigSources';
import type { VersionManagerOptions } from '../../domain/models/VersionManagerOptions';
import { MockClock } from '../mocks/MockClock';

function makeDeps(overrides: {
  envOverrides?: IEnvironmentOverrideSource;
  remote?: IRemoteConfigSource;
  local?: ILocalConfigSource;
  cache?: IConfigCache;
  refreshIntervalMs?: number;
}) {
  const cacheStore = new Map<string, unknown>();
  const local: ILocalConfigSource = overrides.local ?? {
    read: async () => null,
  };
  const remote: IRemoteConfigSource = overrides.remote ?? {
    fetch: async () => ({}),
  };
  const envOverrides: IEnvironmentOverrideSource = overrides.envOverrides ?? {
    read: async () => ({}),
  };
  const cache: IConfigCache = overrides.cache ?? {
    getLastValid: async () => (cacheStore.get('k') as never) ?? null,
    setLastValid: async (config) => {
      cacheStore.set('k', config);
    },
  };
  const signatureVerifier: ISignatureVerifier = {
    verify: async () => ({ valid: true }),
  };

  return {
    local,
    remote,
    envOverrides,
    cache,
    validator: new ConfigDocumentValidator(),
    signatureVerifier,
    clock: new MockClock(),
    refreshIntervalMs: overrides.refreshIntervalMs,
  };
}

const defaults: VersionManagerOptions = {
  stores: { custom: { url: 'https://example.com/version.json' } },
};

describe('ConfigProvider', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves the tier-4 default config when no local/remote/env source supplies anything', async () => {
    const provider = new ConfigProvider(makeDeps({}));
    const config = await provider.resolve(defaults);
    expect(config.stores.custom?.url).toBe('https://example.com/version.json');
  });

  it('applies env overrides on top of the default tier (highest precedence)', async () => {
    const provider = new ConfigProvider(
      makeDeps({
        envOverrides: {
          read: async () => ({ alerts: { reminderDelayMs: 999 } }),
        },
      })
    );
    const config = await provider.resolve(defaults);
    expect(config.policy.reminderIntervalMs).toBe(999);
  });

  it('load() delegates to resolve() with request.defaults', async () => {
    const provider = new ConfigProvider(makeDeps({}));
    const config = await provider.load({ defaults });
    expect(config.stores.custom?.url).toBe('https://example.com/version.json');
  });

  it('subscribe() notifies listeners only when a refresh poll changes the resolved config', async () => {
    jest.useFakeTimers();
    let call = 0;
    const provider = new ConfigProvider(
      makeDeps({
        refreshIntervalMs: 1_000,
        envOverrides: {
          read: async () => {
            call += 1;
            return call === 1
              ? { alerts: { reminderDelayMs: 1 } }
              : { alerts: { reminderDelayMs: 2 } };
          },
        },
      })
    );

    await provider.resolve(defaults);

    const listener = jest.fn();
    const unsubscribe = provider.subscribe(listener);

    await jest.advanceTimersByTimeAsync(1_000);
    expect(listener).toHaveBeenCalledTimes(1);
    const [firstCall] = listener.mock.calls as [
      [{ policy: { reminderIntervalMs: number } }],
    ];
    expect(firstCall[0].policy.reminderIntervalMs).toBe(2);

    unsubscribe();
    await jest.advanceTimersByTimeAsync(1_000);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
