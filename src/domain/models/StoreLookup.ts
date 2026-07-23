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
}
