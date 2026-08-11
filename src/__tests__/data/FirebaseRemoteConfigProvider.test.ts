import { describe, expect, it } from '@jest/globals';
import { FirebaseRemoteConfigProvider } from '../../data/providers/firebase-remote-config/FirebaseRemoteConfigProvider';
import {
  StorePermissionException,
  StoreResponseParseException,
} from '../../domain/errors/VersionManagerException';
import type {
  HttpRequest,
  HttpResponse,
  IHttpClient,
} from '../../domain/ports/IPlatformBridge';

const baseRequest = {
  bundleId: 'com.example.app',
  region: null,
  timeoutMs: 1000,
};
const baseConfig = {
  apiKey: 'test-api-key',
  projectId: '1234567890',
  appId: '1:1234567890:android:abcdef123456',
};

function httpStub(
  handler: (req: HttpRequest, callIndex: number) => HttpResponse
): { http: IHttpClient; requests: HttpRequest[] } {
  const requests: HttpRequest[] = [];
  return {
    requests,
    http: {
      request: async (req) => {
        requests.push(req);
        return handler(req, requests.length - 1);
      },
    },
  };
}

function installationsResponse(fid: string, token: string): HttpResponse {
  return {
    status: 200,
    headers: {},
    body: JSON.stringify({ fid, authToken: { token } }),
  };
}

describe('FirebaseRemoteConfigProvider', () => {
  it('creates an installation then fetches remote config using its fid/token', async () => {
    const { http, requests } = httpStub((_req, i) => {
      if (i === 0) return installationsResponse('the-fid', 'the-token');
      return {
        status: 200,
        headers: {},
        body: JSON.stringify({ entries: { latest_version: '5.0.0' } }),
      };
    });
    const provider = new FirebaseRemoteConfigProvider(
      http,
      'android',
      baseConfig
    );

    const result = await provider.fetchLatestVersionInfo(baseRequest);

    expect(result.latestVersion).toBe('5.0.0');
    expect(requests[0]?.url).toContain('firebaseinstallations.googleapis.com');
    expect(requests[1]?.url).toContain('firebaseremoteconfig.googleapis.com');
    const fetchBody = JSON.parse(requests[1]?.body ?? '{}') as Record<
      string,
      unknown
    >;
    expect(fetchBody.app_instance_id).toBe('the-fid');
    expect(fetchBody.app_instance_id_token).toBe('the-token');
    expect(fetchBody.platform).toBe('ANDROID');
    expect(fetchBody.package_name).toBe('com.example.app');
  });

  it('maps the platform argument to IOS/WEB for the fetch payload', async () => {
    const { http: iosHttp, requests: iosRequests } = httpStub((_req, i) =>
      i === 0
        ? installationsResponse('fid', 'tok')
        : {
            status: 200,
            headers: {},
            body: JSON.stringify({ entries: { latest_version: '1.0.0' } }),
          }
    );
    const iosProvider = new FirebaseRemoteConfigProvider(
      iosHttp,
      'ios',
      baseConfig
    );
    await iosProvider.fetchLatestVersionInfo(baseRequest);
    const iosBody = JSON.parse(iosRequests[1]?.body ?? '{}') as Record<
      string,
      unknown
    >;
    expect(iosBody.platform).toBe('IOS');

    const { http: webHttp, requests: webRequests } = httpStub((_req, i) =>
      i === 0
        ? installationsResponse('fid', 'tok')
        : {
            status: 200,
            headers: {},
            body: JSON.stringify({ entries: { latest_version: '1.0.0' } }),
          }
    );
    const webProvider = new FirebaseRemoteConfigProvider(
      webHttp,
      'web',
      baseConfig
    );
    await webProvider.fetchLatestVersionInfo(baseRequest);
    const webBody = JSON.parse(webRequests[1]?.body ?? '{}') as Record<
      string,
      unknown
    >;
    expect(webBody.platform).toBe('WEB');
  });

  it('honors a custom parameterKey and storeUrlParameterKey', async () => {
    const { http } = httpStub((_req, i) => {
      if (i === 0) return installationsResponse('fid', 'tok');
      return {
        status: 200,
        headers: {},
        body: JSON.stringify({
          entries: {
            my_version_param: '9.9.9',
            my_store_url_param: 'https://example.com/app',
          },
        }),
      };
    });
    const provider = new FirebaseRemoteConfigProvider(http, 'android', {
      ...baseConfig,
      parameterKey: 'my_version_param',
      storeUrlParameterKey: 'my_store_url_param',
    });

    const result = await provider.fetchLatestVersionInfo(baseRequest);

    expect(result.latestVersion).toBe('9.9.9');
    expect(result.storeUrl).toBe('https://example.com/app');
  });

  it('throws StoreResponseParseException when the parameter key is missing', async () => {
    const { http } = httpStub((_req, i) => {
      if (i === 0) return installationsResponse('fid', 'tok');
      return {
        status: 200,
        headers: {},
        body: JSON.stringify({ entries: {} }),
      };
    });
    const provider = new FirebaseRemoteConfigProvider(
      http,
      'android',
      baseConfig
    );

    await expect(provider.fetchLatestVersionInfo(baseRequest)).rejects.toThrow(
      StoreResponseParseException
    );
  });

  it('maps installations 401/403 to StorePermissionException', async () => {
    const { http } = httpStub(() => ({ status: 403, headers: {}, body: '' }));
    const provider = new FirebaseRemoteConfigProvider(
      http,
      'android',
      baseConfig
    );

    await expect(provider.fetchLatestVersionInfo(baseRequest)).rejects.toThrow(
      StorePermissionException
    );
  });

  it('maps remote-config fetch 401/403 to StorePermissionException', async () => {
    const { http } = httpStub((_req, i) => {
      if (i === 0) return installationsResponse('fid', 'tok');
      return { status: 401, headers: {}, body: '' };
    });
    const provider = new FirebaseRemoteConfigProvider(
      http,
      'android',
      baseConfig
    );

    await expect(provider.fetchLatestVersionInfo(baseRequest)).rejects.toThrow(
      StorePermissionException
    );
  });

  it('throws StoreResponseParseException when installations response is missing fid/token', async () => {
    const { http } = httpStub(() => ({
      status: 200,
      headers: {},
      body: JSON.stringify({}),
    }));
    const provider = new FirebaseRemoteConfigProvider(
      http,
      'android',
      baseConfig
    );

    await expect(provider.fetchLatestVersionInfo(baseRequest)).rejects.toThrow(
      StoreResponseParseException
    );
  });
});
