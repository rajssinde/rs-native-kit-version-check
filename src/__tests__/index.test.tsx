import { afterEach, describe, expect, it } from '@jest/globals';
import { ActionType } from '../domain/models/ActionPlan';
import { VersionManager } from '../index';
import { MockPlatformBridge } from './mocks/MockPlatformBridge';

describe('VersionManager public API', () => {
  afterEach(() => {
    VersionManager.reset();
  });

  it('resolves a SOFT_UPDATE action plan end-to-end against a custom API provider', async () => {
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
      platformBridge: bridge,
    });

    await manager.ready();
    const plan = await manager.checkForUpdates();

    expect(plan.type).toBe(ActionType.SOFT_UPDATE);
    expect(plan.updateInfo?.latestVersion).toBe('1.1.0');
    expect(manager.isUpdateAvailable()).toBe(true);
  });

  it('returns NO_ACTION when already up to date', async () => {
    const bridge = new MockPlatformBridge({
      currentVersion: '1.1.0',
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
      platformBridge: bridge,
    });

    const plan = await manager.checkForUpdates();
    expect(plan.type).toBe(ActionType.NO_ACTION);
  });

  it('throws InvalidConfigException synchronously for an empty stores object', () => {
    expect(() => VersionManager.configure({ stores: {} })).toThrow(
      'at least one store'
    );
  });

  it('getInstance() throws before configure() has ever been called', () => {
    expect(() => VersionManager.getInstance()).toThrow();
  });
});
