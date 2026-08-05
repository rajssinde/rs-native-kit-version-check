import { afterEach, describe, expect, it } from '@jest/globals';
import { ActionType } from '../../domain/models/ActionPlan';
import { VersionManager } from '../../index';
import { MockPlatformBridge } from '../mocks/MockPlatformBridge';

describe('VersionManagerCore — background-check scheduling (doc 04 §2)', () => {
  afterEach(() => {
    VersionManager.reset();
  });

  it('does not schedule when backgroundCheck is omitted (default disabled)', async () => {
    const bridge = new MockPlatformBridge();
    const manager = VersionManager.configure({
      stores: { custom: { url: 'https://example.com/version.json' } },
      platformBridge: bridge,
    });
    await manager.ready();

    expect(bridge.scheduledTasks).toHaveLength(0);
    expect(bridge.canceledTaskIds).toHaveLength(1);
  });

  it('schedules a periodic task when backgroundCheck.enabled is true', async () => {
    const bridge = new MockPlatformBridge();
    const manager = VersionManager.configure({
      stores: { custom: { url: 'https://example.com/version.json' } },
      backgroundCheck: { enabled: true, minIntervalMs: 3_600_000 },
      platformBridge: bridge,
    });
    await manager.ready();

    expect(bridge.scheduledTasks).toHaveLength(1);
    expect(bridge.scheduledTasks[0]?.minIntervalMs).toBe(3_600_000);
    expect(bridge.canceledTaskIds).toHaveLength(0);
  });

  it('defaults minIntervalMs to cache.ttlMs when backgroundCheck.minIntervalMs is omitted', async () => {
    const bridge = new MockPlatformBridge();
    const manager = VersionManager.configure({
      stores: { custom: { url: 'https://example.com/version.json' } },
      cache: { ttlMs: 1_800_000 },
      backgroundCheck: { enabled: true },
      platformBridge: bridge,
    });
    await manager.ready();

    expect(bridge.scheduledTasks[0]?.minIntervalMs).toBe(1_800_000);
  });

  it('the onFire callback triggers a real, cache-respecting checkForUpdates() call', async () => {
    const bridge = new MockPlatformBridge({
      currentVersion: '1.0.0',
      httpHandler: () => ({
        status: 200,
        headers: {},
        body: JSON.stringify({
          latestVersion: '1.1.0',
          storeUrl: 'https://example.com/app',
        }),
      }),
    });
    const manager = VersionManager.configure({
      stores: { custom: { url: 'https://example.com/version.json' } },
      backgroundCheck: { enabled: true, minIntervalMs: 3_600_000 },
      platformBridge: bridge,
    });
    await manager.ready();

    bridge.fireScheduledTask();
    // checkForUpdates() runs asynchronously off the fire-and-forget onFire callback.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(manager.getActionPlan()?.type).toBe(ActionType.SOFT_UPDATE);
  });
});
