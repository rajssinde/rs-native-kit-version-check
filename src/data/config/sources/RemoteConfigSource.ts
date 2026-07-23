import {
  OfflineException,
  StoreResponseParseException,
} from '../../../domain/errors/VersionManagerException';
import type {
  FetchOptions,
  RawConfigDocument,
} from '../../../domain/models/ConfigDocument';
import type { IRemoteConfigSource } from '../../../domain/ports/IConfigSources';
import type { IHttpClient } from '../../../domain/ports/IPlatformBridge';

/** Doc 03 §4.3 — the remote-fetch tier, reached through the same IHttpClient port every other network call in this SDK uses. */
export class RemoteConfigSource implements IRemoteConfigSource {
  constructor(private readonly http: IHttpClient) {}

  async fetch(url: string, options: FetchOptions): Promise<RawConfigDocument> {
    const response = await this.http.request({
      url,
      method: 'GET',
      headers: options.headers,
      timeoutMs: options.timeoutMs,
    });

    if (response.status !== 200) {
      throw new OfflineException({
        message: `Remote config fetch returned HTTP ${response.status}`,
        metadata: { url, status: response.status },
      });
    }

    try {
      return JSON.parse(response.body);
    } catch (error) {
      throw new StoreResponseParseException({
        message: 'Remote config endpoint returned malformed JSON',
        cause: error,
        metadata: { url },
      });
    }
  }
}
