import { describe, expect, it } from '@jest/globals';
import { AppleStoreProvider } from '../../data/providers/apple/AppleStoreProvider';
import { GooglePlayProvider } from '../../data/providers/google-play/GooglePlayProvider';
import type {
  HttpRequest,
  HttpResponse,
  IHttpClient,
} from '../../domain/ports/IPlatformBridge';

function httpStub(handler: (req: HttpRequest) => HttpResponse): IHttpClient {
  return { request: async (req) => handler(req) };
}

describe('AppleStoreProvider — bundle id fallback', () => {
  it('looks up by appStoreId when one is configured', async () => {
    let capturedUrl = '';
    const http = httpStub((req) => {
      capturedUrl = req.url;
      return {
        status: 200,
        headers: {},
        body: JSON.stringify({
          resultCount: 1,
          results: [
            { version: '2.0.0', trackViewUrl: 'https://apps.apple.com/app' },
          ],
        }),
      };
    });
    const provider = new AppleStoreProvider(http, '123456789');

    await provider.fetchLatestVersionInfo({
      bundleId: 'com.example.app',
      region: null,
      timeoutMs: 1000,
    });

    expect(capturedUrl).toContain('id=123456789');
    expect(capturedUrl).not.toContain('bundleId=');
  });

  it('falls back to the running app bundle id when no appStoreId is configured', async () => {
    let capturedUrl = '';
    const http = httpStub((req) => {
      capturedUrl = req.url;
      return {
        status: 200,
        headers: {},
        body: JSON.stringify({
          resultCount: 1,
          results: [
            { version: '2.0.0', trackViewUrl: 'https://apps.apple.com/app' },
          ],
        }),
      };
    });
    const provider = new AppleStoreProvider(http);

    await provider.fetchLatestVersionInfo({
      bundleId: 'com.example.app',
      region: null,
      timeoutMs: 1000,
    });

    expect(capturedUrl).toContain('bundleId=com.example.app');
    expect(capturedUrl).not.toContain('id=1');
  });
});

describe('GooglePlayProvider — bundle id fallback', () => {
  it('looks up by packageName when one is configured', async () => {
    let capturedUrl = '';
    const http = httpStub((req) => {
      capturedUrl = req.url;
      return {
        status: 200,
        headers: {},
        body: '[[["2.0.0"]]]',
      };
    });
    const provider = new GooglePlayProvider(http, 'com.configured.app');

    const result = await provider.fetchLatestVersionInfo({
      bundleId: 'com.example.app',
      region: null,
      timeoutMs: 1000,
    });

    expect(capturedUrl).toContain('id=com.configured.app');
    expect(result.storeUrl).toContain('com.configured.app');
  });

  it('falls back to the running app bundle id when no packageName is configured', async () => {
    let capturedUrl = '';
    const http = httpStub((req) => {
      capturedUrl = req.url;
      return {
        status: 200,
        headers: {},
        body: '[[["2.0.0"]]]',
      };
    });
    const provider = new GooglePlayProvider(http);

    const result = await provider.fetchLatestVersionInfo({
      bundleId: 'com.example.app',
      region: null,
      timeoutMs: 1000,
    });

    expect(capturedUrl).toContain('id=com.example.app');
    expect(result.storeUrl).toContain('com.example.app');
  });
});

describe('GooglePlayProvider — region (doc 04 §3)', () => {
  it('appends gl=<region> to both the fetch URL and the returned storeUrl when configured', async () => {
    let capturedUrl = '';
    const http = httpStub((req) => {
      capturedUrl = req.url;
      return {
        status: 200,
        headers: {},
        body: '[[["2.0.0"]]]',
      };
    });
    const provider = new GooglePlayProvider(http, 'com.configured.app', 'jp');

    const result = await provider.fetchLatestVersionInfo({
      bundleId: 'com.example.app',
      region: null,
      timeoutMs: 1000,
    });

    expect(capturedUrl).toContain('gl=jp');
    expect(result.storeUrl).toContain('gl=jp');
  });

  it('omits gl entirely when no region is configured', async () => {
    let capturedUrl = '';
    const http = httpStub((req) => {
      capturedUrl = req.url;
      return {
        status: 200,
        headers: {},
        body: '[[["2.0.0"]]]',
      };
    });
    const provider = new GooglePlayProvider(http, 'com.configured.app');

    const result = await provider.fetchLatestVersionInfo({
      bundleId: 'com.example.app',
      region: null,
      timeoutMs: 1000,
    });

    expect(capturedUrl).not.toContain('gl=');
    expect(result.storeUrl).not.toContain('gl=');
  });

  it('a per-request region overrides the constructor default', async () => {
    let capturedUrl = '';
    const http = httpStub((req) => {
      capturedUrl = req.url;
      return {
        status: 200,
        headers: {},
        body: '[[["2.0.0"]]]',
      };
    });
    const provider = new GooglePlayProvider(http, 'com.configured.app', 'jp');

    await provider.fetchLatestVersionInfo({
      bundleId: 'com.example.app',
      region: 'de',
      timeoutMs: 1000,
    });

    expect(capturedUrl).toContain('gl=de');
    expect(capturedUrl).not.toContain('gl=jp');
  });
});
