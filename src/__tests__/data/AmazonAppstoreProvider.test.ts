import { describe, expect, it } from '@jest/globals';
import { AmazonAppstoreProvider } from '../../data/providers/amazon/AmazonAppstoreProvider';
import {
  AppNotFoundException,
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

describe('AmazonAppstoreProvider', () => {
  it('extracts the version from a JSON-LD softwareVersion field', async () => {
    let capturedUrl = '';
    const http = httpStub((req) => {
      capturedUrl = req.url;
      return {
        status: 200,
        headers: {},
        body: '<script type="application/ld+json">{"softwareVersion":"2.5.1"}</script>',
      };
    });
    const provider = new AmazonAppstoreProvider(http, 'B0731LX7VR');

    const result = await provider.fetchLatestVersionInfo(baseRequest);

    expect(capturedUrl).toContain('B0731LX7VR');
    expect(result.latestVersion).toBe('2.5.1');
    expect(result.storeUrl).toContain('B0731LX7VR');
  });

  it('falls back to a plain-text "Version" pattern when no JSON-LD is present', async () => {
    const http = httpStub(() => ({
      status: 200,
      headers: {},
      body: '<div>Version: 1.2.3</div>',
    }));
    const provider = new AmazonAppstoreProvider(http, 'B0731LX7VR');

    const result = await provider.fetchLatestVersionInfo(baseRequest);

    expect(result.latestVersion).toBe('1.2.3');
  });

  it('maps 404 to AppNotFoundException', async () => {
    const http = httpStub(() => ({ status: 404, headers: {}, body: '' }));
    const provider = new AmazonAppstoreProvider(http, 'B0731LX7VR');

    await expect(provider.fetchLatestVersionInfo(baseRequest)).rejects.toThrow(
      AppNotFoundException
    );
  });

  it('throws StoreResponseParseException when no version can be extracted', async () => {
    const http = httpStub(() => ({
      status: 200,
      headers: {},
      body: '<div>no version info here</div>',
    }));
    const provider = new AmazonAppstoreProvider(http, 'B0731LX7VR');

    await expect(provider.fetchLatestVersionInfo(baseRequest)).rejects.toThrow(
      StoreResponseParseException
    );
  });

  it('throws StoreResponseParseException on other non-200 statuses', async () => {
    const http = httpStub(() => ({ status: 503, headers: {}, body: '' }));
    const provider = new AmazonAppstoreProvider(http, 'B0731LX7VR');

    await expect(provider.fetchLatestVersionInfo(baseRequest)).rejects.toThrow(
      StoreResponseParseException
    );
  });
});
