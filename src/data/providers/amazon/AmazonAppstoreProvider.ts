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
 * Amazon has no official, unauthenticated app-version lookup API — unlike Google Play's
 * listing page (which embeds a parseable inline JSON blob), Amazon's public product page
 * does not reliably expose a machine-parseable version field at all. This provider is a
 * best-effort HTML scrape only, weaker and less stable than GooglePlayProvider's own
 * scrape; when no version can be extracted it throws StoreResponseParseException, which
 * the sequential-fallback VersionRepositoryImpl already handles by moving on to the next
 * registered provider. Consumers who need reliable Amazon Appstore version data should
 * prefer the `custom` provider pointed at their own endpoint instead.
 */
export class AmazonAppstoreProvider implements IStoreProvider {
  readonly id: StoreProviderId = 'amazon';

  constructor(
    private readonly http: IHttpClient,
    private readonly asin: string
  ) {}

  async fetchLatestVersionInfo(
    request: StoreLookupRequest
  ): Promise<StoreLookupResult> {
    const storeUrl = `https://www.amazon.com/dp/${encodeURIComponent(this.asin)}`;
    const response = await this.http.request({
      url: storeUrl,
      method: 'GET',
      timeoutMs: request.timeoutMs,
    });

    if (response.status === 404) {
      throw new AppNotFoundException({
        message: `No app found on Amazon Appstore for ASIN "${this.asin}"`,
        metadata: { asin: this.asin },
      });
    }
    if (response.status !== 200) {
      throw new StoreResponseParseException({
        message: `Amazon Appstore returned HTTP ${response.status}`,
      });
    }

    const version = extractAmazonVersion(response.body);
    if (!version) {
      throw new StoreResponseParseException({
        message:
          'Could not extract a version string from the Amazon Appstore listing page (best-effort scrape; Amazon does not reliably expose version data)',
        metadata: { asin: this.asin },
      });
    }

    return {
      latestVersion: version,
      storeUrl,
      releaseNotes: null,
      minimumOsVersion: null,
    };
  }
}

function extractAmazonVersion(html: string): string | null {
  const jsonLdMatch = /"softwareVersion"\s*:\s*"([\d.]+)"/.exec(html);
  if (jsonLdMatch?.[1]) return jsonLdMatch[1];

  const textMatch = /Version[^0-9]{0,20}(\d+(?:\.\d+){1,3})/i.exec(html);
  return textMatch?.[1] ?? null;
}
