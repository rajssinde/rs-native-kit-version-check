import {
  AppNotFoundException,
  RateLimitException,
  StorePermissionException,
  StoreResponseParseException,
} from '../../../domain/errors/VersionManagerException';
import type { StoreProviderId } from '../../../domain/models/PlatformId';
import type {
  StoreLookupRequest,
  StoreLookupResult,
} from '../../../domain/models/StoreLookup';
import type { IHttpClient } from '../../../domain/ports/IPlatformBridge';
import type { IStoreProvider } from '../../../domain/ports/IStoreProvider';

interface AgcAppInfoResponse {
  version?: string;
  versionName?: string;
  releaseNotes?: string;
  minimumOsVersion?: string;
}

/**
 * Huawei AppGallery's public app-detail page is a client-rendered SPA — the version is
 * never present in the raw HTTP response, so (unlike GooglePlayProvider) an
 * unauthenticated regex scrape isn't viable here; confirmed by fetching a live page
 * during design, not assumed. Instead this calls Huawei AGC's "App Info Query" Open API,
 * authenticated with a bearer token the *consumer's own backend* obtains via Huawei's
 * OAuth client_id/secret flow — this provider never performs that OAuth exchange itself.
 *
 * The exact AGC response field names below (`version`/`versionName`) are per Huawei's
 * documented Open API but have not been verified against a live authenticated call in
 * this pass (no Huawei developer credentials available) — parsing is isolated in
 * parseAppInfoResponse() specifically so it's a one-function fix if the real shape
 * differs. Treat this integration as needing a manual verification pass against a real
 * AGC account before relying on it in production.
 */
export class HuaweiAppGalleryProvider implements IStoreProvider {
  readonly id: StoreProviderId = 'huawei';

  constructor(
    private readonly http: IHttpClient,
    private readonly appId: string,
    private readonly getAccessToken: () => string | Promise<string>,
    private readonly clientId?: string
  ) {}

  async fetchLatestVersionInfo(
    request: StoreLookupRequest
  ): Promise<StoreLookupResult> {
    const token = await this.getAccessToken();
    const response = await this.http.request({
      url: `https://connect-api.cloud.huawei.com/api/publish/v2/app-info?appId=${encodeURIComponent(this.appId)}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(this.clientId ? { client_id: this.clientId } : {}),
      },
      timeoutMs: request.timeoutMs,
    });

    if (response.status === 401 || response.status === 403) {
      throw new StorePermissionException({
        message: `Huawei AGC App Info Query rejected the request (HTTP ${response.status})`,
      });
    }
    if (response.status === 429) {
      throw new RateLimitException({
        message: 'Huawei AGC App Info Query rate limit exceeded (HTTP 429)',
      });
    }
    if (response.status !== 200) {
      throw new AppNotFoundException({
        message: `Huawei AGC App Info Query returned HTTP ${response.status}`,
        metadata: { appId: this.appId, status: response.status },
      });
    }

    let payload: AgcAppInfoResponse;
    try {
      payload = JSON.parse(response.body) as AgcAppInfoResponse;
    } catch (error) {
      throw new StoreResponseParseException({
        message: 'Huawei AGC App Info Query returned malformed JSON',
        cause: error,
      });
    }

    return this.parseAppInfoResponse(payload);
  }

  private parseAppInfoResponse(payload: AgcAppInfoResponse): StoreLookupResult {
    const latestVersion = payload.version ?? payload.versionName;
    if (!latestVersion) {
      throw new StoreResponseParseException({
        message:
          'Huawei AGC App Info Query response is missing a "version"/"versionName" field',
        metadata: { appId: this.appId },
      });
    }

    return {
      latestVersion,
      storeUrl: `https://appgallery.huawei.com/app/C${this.appId}`,
      releaseNotes: payload.releaseNotes ?? null,
      minimumOsVersion: payload.minimumOsVersion ?? null,
    };
  }
}
