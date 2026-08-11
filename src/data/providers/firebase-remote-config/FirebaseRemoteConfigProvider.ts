import {
  StorePermissionException,
  StoreResponseParseException,
} from '../../../domain/errors/VersionManagerException';
import type {
  PlatformId,
  StoreProviderId,
} from '../../../domain/models/PlatformId';
import type {
  StoreLookupRequest,
  StoreLookupResult,
} from '../../../domain/models/StoreLookup';
import type { IHttpClient } from '../../../domain/ports/IPlatformBridge';
import type { IStoreProvider } from '../../../domain/ports/IStoreProvider';

export interface FirebaseRemoteConfigProviderConfig {
  apiKey: string;
  projectId: string;
  appId: string;
  parameterKey?: string;
  storeUrlParameterKey?: string;
  releaseNotesParameterKey?: string;
  minimumOsVersionParameterKey?: string;
}

interface FirebaseInstallation {
  fid: string;
  authToken: string;
}

interface FirebaseInstallationsResponse {
  fid?: string;
  authToken?: { token?: string };
}

interface FirebaseRemoteConfigFetchResponse {
  entries?: Record<string, string>;
}

const DEFAULT_PARAMETER_KEY = 'latest_version';
// Version reported to Firebase's REST endpoints — not tied to this package's own
// version, just needs to look like a plausible SDK identifier per the fetch contract.
const SDK_VERSION = 'w:0.6.9';

/**
 * Firebase Remote Config has no unauthenticated public API, but the native SDK's own
 * fetch flow (Installations API for an instance token, then Remote Config's `:fetch`
 * endpoint) is plain REST over HTTPS — this reimplements that flow directly on
 * IHttpClient so consumers get real Remote Config values without pulling in the
 * Firebase SDK (which would need google-services.json/GoogleService-Info.plist and
 * violate this package's single-dependency design). This is a reverse-engineered,
 * unofficial contract, not a documented public API — treat it with the same
 * "may change without notice" caution as GooglePlayProvider's own scrape.
 */
export class FirebaseRemoteConfigProvider implements IStoreProvider {
  readonly id: StoreProviderId = 'firebase-remote-config';

  constructor(
    private readonly http: IHttpClient,
    private readonly platform: PlatformId,
    private readonly config: FirebaseRemoteConfigProviderConfig
  ) {}

  async fetchLatestVersionInfo(
    request: StoreLookupRequest
  ): Promise<StoreLookupResult> {
    const installation = await this.createInstallation(request.timeoutMs);
    const entries = await this.fetchRemoteConfigEntries(installation, request);

    const parameterKey = this.config.parameterKey ?? DEFAULT_PARAMETER_KEY;
    const latestVersion = entries[parameterKey];
    if (!latestVersion) {
      throw new StoreResponseParseException({
        message: `Firebase Remote Config parameter "${parameterKey}" is missing or empty`,
        metadata: { parameterKey },
      });
    }

    return {
      latestVersion,
      storeUrl:
        this.readOptionalEntry(entries, this.config.storeUrlParameterKey) ?? '',
      releaseNotes: this.readOptionalEntry(
        entries,
        this.config.releaseNotesParameterKey
      ),
      minimumOsVersion: this.readOptionalEntry(
        entries,
        this.config.minimumOsVersionParameterKey
      ),
    };
  }

  private readOptionalEntry(
    entries: Record<string, string>,
    key: string | undefined
  ): string | null {
    if (!key) return null;
    return entries[key] ?? null;
  }

  private async createInstallation(
    timeoutMs: number
  ): Promise<FirebaseInstallation> {
    const fid = generateFid();
    const response = await this.http.request({
      url: `https://firebaseinstallations.googleapis.com/v1/projects/${encodeURIComponent(this.config.projectId)}/installations`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        fid,
        appId: this.config.appId,
        authVersion: 'FIS_v2',
        sdkVersion: SDK_VERSION,
      }),
      timeoutMs,
    });

    if (response.status === 401 || response.status === 403) {
      throw new StorePermissionException({
        message: `Firebase Installations API rejected the request (HTTP ${response.status})`,
      });
    }
    if (response.status !== 200 && response.status !== 201) {
      throw new StoreResponseParseException({
        message: `Firebase Installations API returned HTTP ${response.status}`,
      });
    }

    let payload: FirebaseInstallationsResponse;
    try {
      payload = JSON.parse(response.body) as FirebaseInstallationsResponse;
    } catch (error) {
      throw new StoreResponseParseException({
        message: 'Firebase Installations API returned malformed JSON',
        cause: error,
      });
    }

    const token = payload.authToken?.token;
    if (!payload.fid || !token) {
      throw new StoreResponseParseException({
        message:
          'Firebase Installations API response is missing "fid"/"authToken.token"',
      });
    }

    return { fid: payload.fid, authToken: token };
  }

  private async fetchRemoteConfigEntries(
    installation: FirebaseInstallation,
    request: StoreLookupRequest
  ): Promise<Record<string, string>> {
    const platform =
      this.platform === 'ios'
        ? 'IOS'
        : this.platform === 'android'
          ? 'ANDROID'
          : 'WEB';

    const response = await this.http.request({
      url: `https://firebaseremoteconfig.googleapis.com/v1/projects/${encodeURIComponent(this.config.projectId)}/namespaces/firebase:fetch?key=${encodeURIComponent(this.config.apiKey)}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: this.config.appId,
        app_instance_id: installation.fid,
        app_instance_id_token: installation.authToken,
        platform,
        package_name: request.bundleId,
        sdk_version: SDK_VERSION,
      }),
      timeoutMs: request.timeoutMs,
    });

    if (response.status === 401 || response.status === 403) {
      throw new StorePermissionException({
        message: `Firebase Remote Config fetch rejected the request (HTTP ${response.status})`,
      });
    }
    if (response.status !== 200) {
      throw new StoreResponseParseException({
        message: `Firebase Remote Config fetch returned HTTP ${response.status}`,
      });
    }

    let payload: FirebaseRemoteConfigFetchResponse;
    try {
      payload = JSON.parse(response.body) as FirebaseRemoteConfigFetchResponse;
    } catch (error) {
      throw new StoreResponseParseException({
        message: 'Firebase Remote Config fetch returned malformed JSON',
        cause: error,
      });
    }

    return payload.entries ?? {};
  }
}

/**
 * Firebase Installation ID (FID): 22 base64url characters encoding 17 random bytes,
 * with the top 4 bits of the first byte fixed to 0b0111 per the Installations spec.
 * Generated locally purely as a client-instance identifier — no security property is
 * needed, so Math.random() is sufficient and avoids any crypto dependency.
 */
function generateFid(): string {
  const bytes = new Uint8Array(17);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[0] = 0b01110000 + (bytes[0]! % 0b00010000);
  return base64UrlEncode(bytes).substring(0, 22);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/[=]+$/, '');
}
