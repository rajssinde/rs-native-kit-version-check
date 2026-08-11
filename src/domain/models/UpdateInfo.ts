import type { StoreProviderId } from './PlatformId';

/**
 * Doc 06 §2 — whether this release can be resolved by an OTA/CodePush/EAS Update
 * bundle reload, or needs a new native binary from the store. This library never
 * verifies the assertion (no OTA client is a dependency here, see doc 06 §2's
 * "signal-only" design) — it only carries whatever the remote signal asserted,
 * defaulting to 'binary' (today's behavior) when unset.
 */
export type UpdateChannel = 'ota' | 'binary';

export interface UpdateInfo {
  readonly currentVersion: string;
  readonly latestVersion: string;
  readonly storeUrl: string;
  readonly releaseNotes: string | null;
  readonly isForceUpdate: boolean;
  readonly provider: StoreProviderId;
  readonly fetchedAt: number;
  readonly recommendedChannel: UpdateChannel;
}
