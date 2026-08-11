import type { IClock } from '../../ports/IClock';
import { ActionType } from '../../models/ActionPlan';
import type { ActionPlan } from '../../models/ActionPlan';
import type { RemoteVersionInfo } from '../../models/RemoteVersionInfo';
import type { UpdateInfo } from '../../models/UpdateInfo';

/**
 * Assembles the final ActionPlan (with a fully-populated UpdateInfo, when relevant)
 * from a PolicyEngine classification. Kept separate from PolicyEngine per the Prompt 7
 * Decision Engine split in docs/architecture/01 §5.3 — this is the orchestration step,
 * not the rule evaluation step.
 */
export class DecisionEngine {
  constructor(private readonly clock: IClock) {}

  buildActionPlan(
    actionType: ActionType,
    currentVersion: string,
    remote: RemoteVersionInfo | null
  ): ActionPlan {
    if (actionType === ActionType.NO_ACTION || remote === null) {
      return {
        type: ActionType.NO_ACTION,
        updateInfo: null,
        reason: 'up_to_date_or_suppressed',
        decidedAt: this.clock.now(),
      };
    }

    const updateInfo: UpdateInfo = {
      currentVersion,
      latestVersion: remote.latestVersion,
      storeUrl: remote.storeUrl,
      releaseNotes: remote.releaseNotes,
      isForceUpdate: actionType === ActionType.FORCE_UPDATE,
      provider: remote.provider,
      fetchedAt: remote.fetchedAt,
      recommendedChannel: remote.updateChannel ?? 'binary',
    };

    return {
      type: actionType,
      updateInfo,
      reason: actionType.toLowerCase(),
      decidedAt: this.clock.now(),
    };
  }
}
