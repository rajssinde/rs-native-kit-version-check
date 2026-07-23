import type { ActionType } from '../../models/ActionPlan';
import type { ParsedVersion } from '../../models/ParsedVersion';
import type { UserVersionDecision } from '../../models/RemoteVersionInfo';

export interface PolicyEvaluationContext {
  readonly currentVersion: ParsedVersion;
  readonly remoteVersion: ParsedVersion;
  readonly forceUpdateBelow: ParsedVersion | null;
  readonly userDecision: UserVersionDecision | null;
  readonly now: number;
  readonly rolloutPercentage: number;
  /** Precomputed 0-99 bucket for this device (Prompt 18 rollout hashing — deferred, see PolicyEngine). */
  readonly rolloutBucket: number;
}

export interface IUpdatePolicyEngine {
  evaluate(context: PolicyEvaluationContext): ActionType;
}
