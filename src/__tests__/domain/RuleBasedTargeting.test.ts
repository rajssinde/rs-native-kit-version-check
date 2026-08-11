import { afterEach, describe, expect, it } from '@jest/globals';
import { VersionManager } from '../../index';
import { ActionType } from '../../domain/models/ActionPlan';
import { MockPlatformBridge } from '../mocks/MockPlatformBridge';

const httpHandler = () => ({
  status: 200,
  headers: {},
  body: JSON.stringify({
    latestVersion: '3.0.0',
    storeUrl: 'https://example.com/app',
  }),
});

describe('rule-based targeting end-to-end (doc 06 §3)', () => {
  afterEach(() => {
    VersionManager.reset();
  });

  it("applies a channel-matched rule's forceUpdateBelow instead of the top-level default", async () => {
    const bridge = new MockPlatformBridge({
      httpHandler,
      currentVersion: '2.5.0',
    });

    const manager = VersionManager.configure({
      stores: { custom: { url: 'https://example.com/version.json' } },
      policy: {
        forceUpdateBelow: '1.0.0', // top-level: 2.5.0 would NOT be forced
        channel: 'beta',
        rules: [{ channel: 'beta', forceUpdateBelow: '2.9.0' }], // rule: 2.5.0 IS forced
      },
      platformBridge: bridge,
    });
    await manager.ready();

    const plan = await manager.checkForUpdates();

    expect(plan.type).toBe(ActionType.FORCE_UPDATE);
  });

  it('ignores a rule for the wrong channel and falls back to the top-level default', async () => {
    const bridge = new MockPlatformBridge({
      httpHandler,
      currentVersion: '2.5.0',
    });

    const manager = VersionManager.configure({
      stores: { custom: { url: 'https://example.com/version.json' } },
      policy: {
        forceUpdateBelow: '1.0.0',
        channel: 'prod',
        rules: [{ channel: 'beta', forceUpdateBelow: '2.9.0' }],
      },
      platformBridge: bridge,
    });
    await manager.ready();

    const plan = await manager.checkForUpdates();

    expect(plan.type).not.toBe(ActionType.FORCE_UPDATE);
  });

  it("applies a minOsVersion rule matched against the device's OS version", async () => {
    const bridge = new MockPlatformBridge({
      httpHandler,
      currentVersion: '2.5.0',
    });
    // MockPlatformBridge.deviceInfo.getOsVersion() returns '17.0'.

    const manager = VersionManager.configure({
      stores: { custom: { url: 'https://example.com/version.json' } },
      policy: {
        forceUpdateBelow: '1.0.0',
        rules: [{ minOsVersion: '17.0', forceUpdateBelow: '2.9.0' }],
      },
      platformBridge: bridge,
    });
    await manager.ready();

    const plan = await manager.checkForUpdates();

    expect(plan.type).toBe(ActionType.FORCE_UPDATE);
  });
});
