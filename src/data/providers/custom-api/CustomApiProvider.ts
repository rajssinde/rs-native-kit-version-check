import {
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

interface CustomApiResponsePayload {
  latestVersion?: string;
  storeUrl?: string;
  releaseNotes?: string;
  minimumOsVersion?: string;
}

/** Generic enterprise/private-distribution provider (Prompt 12). */
export class CustomApiProvider implements IStoreProvider {
  readonly id: StoreProviderId = 'custom';

  constructor(
    private readonly http: IHttpClient,
    private readonly url: string,
    private readonly headers: Readonly<Record<string, string>> = {}
  ) {}

  async fetchLatestVersionInfo(
    request: StoreLookupRequest
  ): Promise<StoreLookupResult> {
    const response = await this.http.request({
      url: this.url,
      method: 'GET',
      headers: this.headers,
      timeoutMs: request.timeoutMs,
    });

    if (response.status === 401 || response.status === 403) {
      throw new StorePermissionException({
        message: `Custom API rejected the request (HTTP ${response.status})`,
      });
    }
    if (response.status !== 200) {
      throw new StoreResponseParseException({
        message: `Custom API returned HTTP ${response.status}`,
      });
    }

    let payload: CustomApiResponsePayload;
    try {
      payload = JSON.parse(response.body) as CustomApiResponsePayload;
    } catch (error) {
      throw new StoreResponseParseException({
        message: 'Custom API returned malformed JSON',
        cause: error,
      });
    }

    if (!payload.latestVersion || !payload.storeUrl) {
      throw new StoreResponseParseException({
        message:
          'Custom API response is missing required fields "latestVersion"/"storeUrl"',
      });
    }

    return {
      latestVersion: payload.latestVersion,
      storeUrl: payload.storeUrl,
      releaseNotes: payload.releaseNotes ?? null,
      minimumOsVersion: payload.minimumOsVersion ?? null,
    };
  }
}
