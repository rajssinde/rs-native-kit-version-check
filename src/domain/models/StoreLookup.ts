export interface StoreLookupRequest {
  readonly bundleId: string;
  readonly region: string | null;
  readonly timeoutMs: number;
}

export interface StoreLookupResult {
  readonly latestVersion: string;
  readonly storeUrl: string;
  readonly releaseNotes: string | null;
  readonly minimumOsVersion: string | null;
  /** Doc 06 §2 — only providers that can actually know this (e.g. `custom`, pointed at your own backend) set it; Apple/Google Play lookups never do. */
  readonly updateChannel?: import('./UpdateInfo').UpdateChannel;
}
