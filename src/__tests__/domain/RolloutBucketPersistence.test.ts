import { afterEach, describe, expect, it } from '@jest/globals';
import { VersionManager } from '../../index';
import { MockPlatformBridge } from '../mocks/MockPlatformBridge';

const ROLLOUT_BUCKET_STORAGE_KEY = 'vm_rollout_bucket';

const httpHandler = () => ({
  status: 200,
  headers: {},
  body: JSON.stringify({
    latestVersion: '1.0.0',
    storeUrl: 'https://example.com/app',
  }),
});

describe('rollout bucket persistence (doc 06 §3)', () => {
  afterEach(() => {
    VersionManager.reset();
  });

  it('persists the same bucket across an app restart (a fresh VersionManagerCore sharing the same underlying storage)', async () => {
    const bridge = new MockPlatformBridge({ httpHandler });

    const first = VersionManager.configure({
      stores: { custom: { url: 'https://example.com/version.json' } },
      policy: { rolloutPercentage: 50 },
      platformBridge: bridge,
    });
    await first.ready();
    await first.checkForUpdates();
    const storedAfterFirstRun = await bridge.storage.get(
      ROLLOUT_BUCKET_STORAGE_KEY
    );
    expect(storedAfterFirstRun).not.toBeNull();

    VersionManager.reset();

    const second = VersionManager.configure({
      stores: { custom: { url: 'https://example.com/version.json' } },
      policy: { rolloutPercentage: 50 },
      platformBridge: bridge,
    });
    await second.ready();
    await second.checkForUpdates();
    const storedAfterSecondRun = await bridge.storage.get(
      ROLLOUT_BUCKET_STORAGE_KEY
    );

    expect(storedAfterSecondRun).toBe(storedAfterFirstRun);
  });

  it('falls back to a fresh in-range bucket and re-persists it when the stored value is corrupt', async () => {
    const bridge = new MockPlatformBridge({ httpHandler });
    await bridge.storage.set(ROLLOUT_BUCKET_STORAGE_KEY, 'not-a-number');

    const manager = VersionManager.configure({
      stores: { custom: { url: 'https://example.com/version.json' } },
      platformBridge: bridge,
    });
    await manager.ready();
    await manager.checkForUpdates();

    const stored = await bridge.storage.get(ROLLOUT_BUCKET_STORAGE_KEY);
    const parsed = Number(stored);
    expect(Number.isInteger(parsed)).toBe(true);
    expect(parsed).toBeGreaterThanOrEqual(0);
    expect(parsed).toBeLessThanOrEqual(99);
  });
});
