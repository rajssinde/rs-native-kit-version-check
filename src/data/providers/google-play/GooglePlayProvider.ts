import {
  AppNotFoundException,
  StoreResponseParseException,
} from '../../../domain/errors/VersionManagerException';
import type { StoreProviderId } from '../../../domain/models/PlatformId';
import type {
  StoreLookupRequest,
  StoreLookupResult,
} from '../../../domain/models/StoreLookup';
import type { IHttpClient } from '../../../domain/ports/IPlatformBridge';
import type { IStoreProvider } from '../../../domain/ports/IStoreProvider';

/**
 * Google Play has no public, unauthenticated lookup API (Prompt 10). This provider is a
 * best-effort parser of the public store listing page's inline JSON blob. It is
 * inherently fragile — Play Store markup can change without notice — and is offered as
 * a pragmatic default; production deployments with a Google Play Developer API service
 * account should prefer a IStoreProvider backed by that authenticated API instead.
 *
 * packageName is optional — on Android the app's own bundle id *is* its package name,
 * so when it's not supplied explicitly this falls back to request.bundleId.
 *
 * region (doc 04 §3) maps to Play's `gl=` storefront-region query param — distinct from
 * `hl=` (listing language, currently hardcoded to `en`). Optional: when omitted, `gl` is
 * left off the URL entirely and Play resolves region from the request's own signals.
 */
export class GooglePlayProvider implements IStoreProvider {
  readonly id: StoreProviderId = 'google-play';

  constructor(
    private readonly http: IHttpClient,
    private readonly packageName?: string,
    private readonly region?: string
  ) {}

  async fetchLatestVersionInfo(
    request: StoreLookupRequest
  ): Promise<StoreLookupResult> {
    const packageName = this.packageName ?? request.bundleId;
    const region = request.region ?? this.region;
    const regionParam = region ? `&gl=${encodeURIComponent(region)}` : '';
    const storeUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}&hl=en${regionParam}`;
    const response = await this.http.request({
      url: storeUrl,
      method: 'GET',
      timeoutMs: request.timeoutMs,
    });

    if (response.status === 404) {
      throw new AppNotFoundException({
        message: `No app found on Google Play for package "${packageName}"`,
        metadata: { packageName },
      });
    }
    if (response.status !== 200) {
      throw new StoreResponseParseException({
        message: `Google Play returned HTTP ${response.status}`,
      });
    }

    const version = extractPlayStoreVersion(response.body);
    if (!version) {
      throw new StoreResponseParseException({
        message:
          'Could not extract a version string from the Google Play store page',
        metadata: { packageName },
      });
    }

    return {
      latestVersion: version,
      storeUrl: `https://play.google.com/store/apps/details?id=${packageName}${regionParam}`,
      releaseNotes: null,
      minimumOsVersion: null,
    };
  }
}

function extractPlayStoreVersion(html: string): string | null {
  const match = /\[\[\["(\d+(?:\.\d+){1,3})"\]\]/.exec(html);
  return match?.[1] ?? null;
}
