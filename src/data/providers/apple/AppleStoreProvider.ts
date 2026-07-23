import {
  AppNotFoundException,
  RateLimitException,
  StoreResponseParseException,
} from '../../../domain/errors/VersionManagerException';
import type { StoreProviderId } from '../../../domain/models/PlatformId';
import type {
  StoreLookupRequest,
  StoreLookupResult,
} from '../../../domain/models/StoreLookup';
import type { IHttpClient } from '../../../domain/ports/IPlatformBridge';
import type { IStoreProvider } from '../../../domain/ports/IStoreProvider';

interface AppleLookupResult {
  version: string;
  trackViewUrl: string;
  releaseNotes?: string;
  minimumOsVersion?: string;
}

interface AppleLookupResponse {
  resultCount: number;
  results: AppleLookupResult[];
}

/**
 * Real implementation against the public iTunes Lookup API (Prompt 10). Accepts either
 * the numeric App Store Connect id (`id=`) or, when the app developer doesn't want to
 * hardcode one, falls back to looking the app up by its own bundle id (`bundleId=`) —
 * the iTunes Lookup API supports both query params equivalently.
 */
export class AppleStoreProvider implements IStoreProvider {
  readonly id: StoreProviderId = 'apple';

  constructor(
    private readonly http: IHttpClient,
    private readonly appStoreId?: string,
    private readonly region: string = 'us'
  ) {}

  async fetchLatestVersionInfo(
    request: StoreLookupRequest
  ): Promise<StoreLookupResult> {
    const country = request.region ?? this.region;
    const identifierParam = this.appStoreId
      ? `id=${encodeURIComponent(this.appStoreId)}`
      : `bundleId=${encodeURIComponent(request.bundleId)}`;
    const url = `https://itunes.apple.com/lookup?${identifierParam}&country=${encodeURIComponent(country)}`;
    const response = await this.http.request({
      url,
      method: 'GET',
      timeoutMs: request.timeoutMs,
    });

    const identifier = this.appStoreId ?? request.bundleId;

    if (response.status === 429) {
      throw new RateLimitException({
        message: 'Apple iTunes Lookup API rate limit exceeded (HTTP 429)',
      });
    }
    if (response.status !== 200) {
      throw new AppNotFoundException({
        message: `Apple iTunes Lookup API returned HTTP ${response.status}`,
        metadata: { identifier, status: response.status },
      });
    }

    let payload: AppleLookupResponse;
    try {
      payload = JSON.parse(response.body) as AppleLookupResponse;
    } catch (error) {
      throw new StoreResponseParseException({
        message: 'Apple iTunes Lookup API returned malformed JSON',
        cause: error,
      });
    }

    const result = payload.results[0];
    if (!result) {
      throw new AppNotFoundException({
        message: `No app found in the App Store for "${identifier}"`,
        metadata: { identifier },
      });
    }

    return {
      latestVersion: result.version,
      storeUrl: result.trackViewUrl,
      releaseNotes: result.releaseNotes ?? null,
      minimumOsVersion: result.minimumOsVersion ?? null,
    };
  }
}
