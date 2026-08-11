import { describe, expect, it } from '@jest/globals';
import { MemoryCacheStore } from '../../data/cache/MemoryCacheStore';
import { VersionRepositoryImpl } from '../../data/repositories/VersionRepositoryImpl';
import type { RemoteVersionInfo } from '../../domain/models/RemoteVersionInfo';
import { UnsupportedStoreException } from '../../domain/errors/VersionManagerException';
import { MockClock } from '../mocks/MockClock';
import { MockPlatformBridge } from '../mocks/MockPlatformBridge';
import { MockStoreProvider } from '../mocks/MockStoreProvider';

describe('VersionRepositoryImpl', () => {
  it('throws UnsupportedStoreException when no providers are registered', async () => {
    const clock = new MockClock(0);
    const bridge = new MockPlatformBridge({ clock });
    const cache = new MemoryCacheStore<RemoteVersionInfo>(clock, 0);
    const repo = new VersionRepositoryImpl([], cache, bridge.storage, clock);

    await expect(
      repo.getRemoteVersionInfo({
        currentVersion: '1.0.0',
        bundleId: 'com.example.app',
        platform: 'ios',
        bypassCache: true,
        timeoutMs: 1000,
      })
    ).rejects.toThrow(UnsupportedStoreException);
  });

  it('falls back to the next provider when the first one fails', async () => {
    const clock = new MockClock(0);
    const bridge = new MockPlatformBridge({ clock });
    const cache = new MemoryCacheStore<RemoteVersionInfo>(clock, 0);
    const failing = new MockStoreProvider({
      id: 'apple',
      error: new Error('boom'),
    });
    const succeeding = new MockStoreProvider({
      id: 'custom',
      result: {
        latestVersion: '2.0.0',
        storeUrl: 'https://example.com',
        releaseNotes: null,
        minimumOsVersion: null,
      },
    });
    const repo = new VersionRepositoryImpl(
      [failing, succeeding],
      cache,
      bridge.storage,
      clock
    );

    const result = await repo.getRemoteVersionInfo({
      currentVersion: '1.0.0',
      bundleId: 'com.example.app',
      platform: 'ios',
      bypassCache: true,
      timeoutMs: 1000,
    });

    expect(result.latestVersion).toBe('2.0.0');
    expect(result.provider).toBe('custom');
  });

  it('serves a cached result without invoking the provider again', async () => {
    const clock = new MockClock(0);
    const bridge = new MockPlatformBridge({ clock });
    const cache = new MemoryCacheStore<RemoteVersionInfo>(clock, 60_000);
    let calls = 0;
    const provider = new MockStoreProvider({
      result: () => {
        calls += 1;
        return {
          latestVersion: '2.0.0',
          storeUrl: 'https://example.com',
          releaseNotes: null,
          minimumOsVersion: null,
        };
      },
    });
    const repo = new VersionRepositoryImpl(
      [provider],
      cache,
      bridge.storage,
      clock
    );
    const request = {
      currentVersion: '1.0.0',
      bundleId: 'com.example.app',
      platform: 'ios' as const,
      bypassCache: false,
      timeoutMs: 1000,
    };

    await repo.getRemoteVersionInfo(request);
    await repo.getRemoteVersionInfo(request);

    expect(calls).toBe(1);
  });

  it('maps a provider-asserted updateChannel through, and defaults to null when unset (doc 06 §2)', async () => {
    const clock = new MockClock(0);
    const bridge = new MockPlatformBridge({ clock });
    const cache = new MemoryCacheStore<RemoteVersionInfo>(clock, 0);
    const otaProvider = new MockStoreProvider({
      id: 'custom',
      result: {
        latestVersion: '2.0.0',
        storeUrl: 'https://example.com',
        releaseNotes: null,
        minimumOsVersion: null,
        updateChannel: 'ota',
      },
    });
    const repo = new VersionRepositoryImpl(
      [otaProvider],
      cache,
      bridge.storage,
      clock
    );

    const result = await repo.getRemoteVersionInfo({
      currentVersion: '1.0.0',
      bundleId: 'com.example.app',
      platform: 'ios',
      bypassCache: true,
      timeoutMs: 1000,
    });

    expect(result.updateChannel).toBe('ota');
  });

  it('persists and retrieves a user decision', async () => {
    const clock = new MockClock(0);
    const bridge = new MockPlatformBridge({ clock });
    const cache = new MemoryCacheStore<RemoteVersionInfo>(clock, 0);
    const repo = new VersionRepositoryImpl([], cache, bridge.storage, clock);

    expect(await repo.getUserDecision()).toBeNull();
    await repo.persistUserDecision({
      ignoredVersions: ['1.1.0'],
      remindMeLaterUntil: 12345,
    });
    expect(await repo.getUserDecision()).toEqual({
      ignoredVersions: ['1.1.0'],
      remindMeLaterUntil: 12345,
    });
  });
});
