import { ActionType } from '../../models/ActionPlan';
import type { IVersionComparator } from '../semver/IVersionComparator';
import type {
  IUpdatePolicyEngine,
  PolicyEvaluationContext,
} from './IUpdatePolicyEngine';

/**
 * Minimal rule evaluator: threshold-based force-update classification, ignore-list and
 * remind-later suppression, and rollout-percentage gating. This intentionally covers a
 * subset of the full Rule DSL described for Prompt 6 (conflict resolution across
 * security/force/grace-period/optional tiers) — that richer precedence table is future
 * scope; this engine implements the linear precedence documented inline below.
 */
export class PolicyEngine implements IUpdatePolicyEngine {
  constructor(private readonly comparator: IVersionComparator) {}

  evaluate(context: PolicyEvaluationContext): ActionType {
    const cmp = this.comparator.compare(
      context.currentVersion,
      context.remoteVersion
    );
    if (cmp >= 0) {
      return ActionType.NO_ACTION;
    }

    if (
      context.userDecision?.ignoredVersions.includes(context.remoteVersion.raw)
    ) {
      return ActionType.NO_ACTION;
    }

    const remindMeLaterUntil = context.userDecision?.remindMeLaterUntil ?? null;
    if (remindMeLaterUntil !== null && context.now < remindMeLaterUntil) {
      return ActionType.NO_ACTION;
    }

    if (
      context.forceUpdateBelow &&
      this.comparator.compare(
        context.currentVersion,
        context.forceUpdateBelow
      ) < 0
    ) {
      return ActionType.FORCE_UPDATE;
    }

    if (context.rolloutBucket >= context.rolloutPercentage) {
      return ActionType.NO_ACTION;
    }

    // A previously-expired "remind me later" snooze downgrades to a less intrusive
    // banner on the next detection rather than repeating the modal dialog.
    if (remindMeLaterUntil !== null) {
      return ActionType.OPTIONAL_REMINDER;
    }

    return ActionType.SOFT_UPDATE;
  }
}
