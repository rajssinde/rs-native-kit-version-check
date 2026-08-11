import { describe, expect, it } from '@jest/globals';
import { CustomApiProvider } from '../../data/providers/custom-api/CustomApiProvider';
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

describe('CustomApiProvider updateChannel (doc 06 §2)', () => {
  it('passes through a valid "ota" updateChannel', async () => {
    const http = httpStub(() => ({
      status: 200,
      headers: {},
      body: JSON.stringify({
        latestVersion: '2.0.0',
        storeUrl: 'https://example.com/app',
        updateChannel: 'ota',
      }),
    }));
    const provider = new CustomApiProvider(http, 'https://example.com/v.json');

    const result = await provider.fetchLatestVersionInfo(baseRequest);

    expect(result.updateChannel).toBe('ota');
  });

  it('passes through a valid "binary" updateChannel', async () => {
    const http = httpStub(() => ({
      status: 200,
      headers: {},
      body: JSON.stringify({
        latestVersion: '2.0.0',
        storeUrl: 'https://example.com/app',
        updateChannel: 'binary',
      }),
    }));
    const provider = new CustomApiProvider(http, 'https://example.com/v.json');

    const result = await provider.fetchLatestVersionInfo(baseRequest);

    expect(result.updateChannel).toBe('binary');
  });

  it('ignores an unrecognized updateChannel value rather than rejecting the response', async () => {
    const http = httpStub(() => ({
      status: 200,
      headers: {},
      body: JSON.stringify({
        latestVersion: '2.0.0',
        storeUrl: 'https://example.com/app',
        updateChannel: 'delta-patch',
      }),
    }));
    const provider = new CustomApiProvider(http, 'https://example.com/v.json');

    const result = await provider.fetchLatestVersionInfo(baseRequest);

    expect(result.updateChannel).toBeUndefined();
  });

  it('leaves updateChannel undefined when the field is absent', async () => {
    const http = httpStub(() => ({
      status: 200,
      headers: {},
      body: JSON.stringify({
        latestVersion: '2.0.0',
        storeUrl: 'https://example.com/app',
      }),
    }));
    const provider = new CustomApiProvider(http, 'https://example.com/v.json');

    const result = await provider.fetchLatestVersionInfo(baseRequest);

    expect(result.updateChannel).toBeUndefined();
  });
});
