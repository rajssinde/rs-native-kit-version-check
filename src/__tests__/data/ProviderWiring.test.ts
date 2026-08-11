import { describe, expect, it } from '@jest/globals';
import { createVersionManagerCore } from '../../di/container';
import type {
  HttpRequest,
  HttpResponse,
} from '../../domain/ports/IPlatformBridge';
import { MockPlatformBridge } from '../mocks/MockPlatformBridge';

function customResponse(): HttpResponse {
  return {
    status: 200,
    headers: {},
    body: JSON.stringify({
      latestVersion: '2.0.0',
      storeUrl: 'https://custom.example.com/app',
    }),
  };
}

describe('DI container — Huawei/Amazon/Firebase Remote Config wiring', () => {
  it('does not register Huawei without an access token/callback, falls through to custom', async () => {
    const requestedUrls: string[] = [];
    const bridge = new MockPlatformBridge({
      platform: 'android',
      httpHandler: (req: HttpRequest) => {
        requestedUrls.push(req.url);
        return customResponse();
      },
    });

    const core = createVersionManagerCore({
      appVersion: '1.0.0',
      platformBridge: bridge,
      stores: {
        huawei: { appId: '102717837' },
        custom: { url: 'https://custom.example.com/version.json' },
      },
    });

    await core.checkForUpdates();

    expect(requestedUrls.some((u) => u.includes('huawei'))).toBe(false);
    expect(core.getUpdateInfo()?.provider).toBe('custom');
  });

  it('registers Huawei on android when a static accessToken is provided', async () => {
    const requestedUrls: string[] = [];
    const bridge = new MockPlatformBridge({
      platform: 'android',
      httpHandler: (req: HttpRequest) => {
        requestedUrls.push(req.url);
        return {
          status: 200,
          headers: {},
          body: JSON.stringify({ version: '6.0.0' }),
        };
      },
    });

    const core = createVersionManagerCore({
      appVersion: '1.0.0',
      platformBridge: bridge,
      stores: {
        huawei: { appId: '102717837', accessToken: 'static-token' },
      },
    });

    await core.checkForUpdates();

    expect(
      requestedUrls.some((u) => u.includes('connect-api.cloud.huawei.com'))
    ).toBe(true);
    expect(core.getUpdateInfo()?.provider).toBe('huawei');
  });

  it('does not register Huawei/Amazon on ios, falls through to custom', async () => {
    const requestedUrls: string[] = [];
    const bridge = new MockPlatformBridge({
      platform: 'ios',
      httpHandler: (req: HttpRequest) => {
        requestedUrls.push(req.url);
        return customResponse();
      },
    });

    const core = createVersionManagerCore({
      appVersion: '1.0.0',
      platformBridge: bridge,
      stores: {
        huawei: { appId: '102717837', accessToken: 'static-token' },
        amazon: { asin: 'B0731LX7VR' },
        custom: { url: 'https://custom.example.com/version.json' },
      },
    });

    await core.checkForUpdates();

    expect(requestedUrls.some((u) => u.includes('huawei'))).toBe(false);
    expect(requestedUrls.some((u) => u.includes('amazon'))).toBe(false);
    expect(core.getUpdateInfo()?.provider).toBe('custom');
  });

  it('registers Firebase Remote Config regardless of platform', async () => {
    const bridge = new MockPlatformBridge({
      platform: 'ios',
      httpHandler: (req: HttpRequest) => {
        if (req.url.includes('firebaseinstallations.googleapis.com')) {
          return {
            status: 200,
            headers: {},
            body: JSON.stringify({ fid: 'fid', authToken: { token: 'tok' } }),
          };
        }
        return {
          status: 200,
          headers: {},
          body: JSON.stringify({ entries: { latest_version: '7.0.0' } }),
        };
      },
    });

    const core = createVersionManagerCore({
      appVersion: '1.0.0',
      platformBridge: bridge,
      stores: {
        firebaseRemoteConfig: {
          apiKey: 'test-key',
          projectId: '1234567890',
          appId: '1:1234567890:ios:abcdef123456',
        },
      },
    });

    await core.checkForUpdates();

    expect(core.getUpdateInfo()?.provider).toBe('firebase-remote-config');
  });
});
