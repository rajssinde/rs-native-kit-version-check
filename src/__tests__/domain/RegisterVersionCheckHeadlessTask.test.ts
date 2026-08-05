import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { AppRegistry, Platform } from 'react-native';
import { registerVersionCheckHeadlessTask } from '../../backgroundTask';
import { VersionManager } from '../../index';
import { MockPlatformBridge } from '../mocks/MockPlatformBridge';

describe('registerVersionCheckHeadlessTask (doc 04 §2)', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
    VersionManager.reset();
    jest.restoreAllMocks();
  });

  it('is a no-op on iOS', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    const spy = jest.spyOn(AppRegistry, 'registerHeadlessTask');

    registerVersionCheckHeadlessTask(() => ({ stores: {} }));

    expect(spy).not.toHaveBeenCalled();
  });

  it('registers "VersionCheckBackgroundTask" on Android — matching VersionCheckHeadlessTaskService.TASK_NAME', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    const spy = jest.spyOn(AppRegistry, 'registerHeadlessTask');

    registerVersionCheckHeadlessTask(() => ({ stores: {} }));

    expect(spy).toHaveBeenCalledWith(
      'VersionCheckBackgroundTask',
      expect.any(Function)
    );
  });

  it('the registered task body configures the manager and checks for updates', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
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

    let capturedTaskProvider:
      (() => (data: unknown) => Promise<void>) | undefined;
    jest
      .spyOn(AppRegistry, 'registerHeadlessTask')
      .mockImplementation((_name, provider) => {
        capturedTaskProvider = provider as typeof capturedTaskProvider;
      });

    registerVersionCheckHeadlessTask(() => ({
      stores: { custom: { url: 'https://example.com/version.json' } },
      platformBridge: bridge,
    }));

    expect(capturedTaskProvider).toBeDefined();
    await capturedTaskProvider!()(undefined);

    expect(
      VersionManager.getInstance().getActionPlan()?.updateInfo?.latestVersion
    ).toBe('1.1.0');
  });
});
