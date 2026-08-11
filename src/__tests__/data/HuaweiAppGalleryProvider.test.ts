import { describe, expect, it } from '@jest/globals';
import { HuaweiAppGalleryProvider } from '../../data/providers/huawei/HuaweiAppGalleryProvider';
import {
  AppNotFoundException,
  RateLimitException,
  StorePermissionException,
  StoreResponseParseException,
} from '../../domain/errors/VersionManagerException';
import type {
  HttpRequest,
  HttpResponse,
  IHttpClient,
} from '../../domain/ports/IPlatformBridge';

function httpStub(handler: (req: HttpRequest) => HttpResponse): IHttpClient {
  return { request: async (req) => handler(req) };
}

const baseRequest = {
  bundleId: 'com.example.app',
  region: null,
  timeoutMs: 1000,
};

describe('HuaweiAppGalleryProvider', () => {
  it('sends a bearer token from a static getAccessToken and parses the version', async () => {
    let capturedAuth = '';
    let capturedUrl = '';
    const http = httpStub((req) => {
      capturedAuth = req.headers?.Authorization ?? '';
      capturedUrl = req.url;
      return {
        status: 200,
        headers: {},
        body: JSON.stringify({ version: '3.1.0' }),
      };
    });
    const provider = new HuaweiAppGalleryProvider(
      http,
      '102717837',
      () => 'my-token'
    );

    const result = await provider.fetchLatestVersionInfo(baseRequest);

    expect(capturedAuth).toBe('Bearer my-token');
    expect(capturedUrl).toContain('appId=102717837');
    expect(result.latestVersion).toBe('3.1.0');
    expect(result.storeUrl).toBe(
      'https://appgallery.huawei.com/app/C102717837'
    );
  });

  it('resolves an async getAccessToken callback and sends the client_id header', async () => {
    let capturedClientId = '';
    const http = httpStub((req) => {
      capturedClientId = req.headers?.client_id ?? '';
      return {
        status: 200,
        headers: {},
        body: JSON.stringify({ versionName: '4.0.0' }),
      };
    });
    const provider = new HuaweiAppGalleryProvider(
      http,
      '102717837',
      async () => 'async-token',
      'my-client-id'
    );

    const result = await provider.fetchLatestVersionInfo(baseRequest);

    expect(capturedClientId).toBe('my-client-id');
    expect(result.latestVersion).toBe('4.0.0');
  });

  it('maps 401/403 to StorePermissionException', async () => {
    const http = httpStub(() => ({ status: 403, headers: {}, body: '' }));
    const provider = new HuaweiAppGalleryProvider(http, '102717837', () => 't');

    await expect(provider.fetchLatestVersionInfo(baseRequest)).rejects.toThrow(
      StorePermissionException
    );
  });

  it('maps 429 to RateLimitException', async () => {
    const http = httpStub(() => ({ status: 429, headers: {}, body: '' }));
    const provider = new HuaweiAppGalleryProvider(http, '102717837', () => 't');

    await expect(provider.fetchLatestVersionInfo(baseRequest)).rejects.toThrow(
      RateLimitException
    );
  });

  it('maps other non-200 statuses to AppNotFoundException', async () => {
    const http = httpStub(() => ({ status: 404, headers: {}, body: '' }));
    const provider = new HuaweiAppGalleryProvider(http, '102717837', () => 't');

    await expect(provider.fetchLatestVersionInfo(baseRequest)).rejects.toThrow(
      AppNotFoundException
    );
  });

  it('throws StoreResponseParseException on malformed JSON', async () => {
    const http = httpStub(() => ({
      status: 200,
      headers: {},
      body: 'not json',
    }));
    const provider = new HuaweiAppGalleryProvider(http, '102717837', () => 't');

    await expect(provider.fetchLatestVersionInfo(baseRequest)).rejects.toThrow(
      StoreResponseParseException
    );
  });

  it('throws StoreResponseParseException when no version field is present', async () => {
    const http = httpStub(() => ({
      status: 200,
      headers: {},
      body: JSON.stringify({ releaseNotes: 'notes only' }),
    }));
    const provider = new HuaweiAppGalleryProvider(http, '102717837', () => 't');

    await expect(provider.fetchLatestVersionInfo(baseRequest)).rejects.toThrow(
      StoreResponseParseException
    );
  });
});
