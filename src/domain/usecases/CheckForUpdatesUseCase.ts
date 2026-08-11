import type { DecisionEngine } from '../engines/decision/DecisionEngine';
import type { IUpdatePolicyEngine } from '../engines/policy/IUpdatePolicyEngine';
import { resolveEffectivePolicy } from '../engines/policy/TargetingRuleResolver';
import type { IVersionComparator } from '../engines/semver/IVersionComparator';
import type { ActionPlan } from '../models/ActionPlan';
import type { PlatformId } from '../models/PlatformId';
import type { TargetingRule } from '../models/VersionManagerOptions';
import type { IClock } from '../ports/IClock';
import type { IVersionRepository } from '../ports/IVersionRepository';

export interface CheckForUpdatesUseCaseDeps {
  readonly repository: IVersionRepository;
  readonly comparator: IVersionComparator;
  readonly policyEngine: IUpdatePolicyEngine;
  readonly decisionEngine: DecisionEngine;
  readonly clock: IClock;
}

export interface CheckForUpdatesInput {
  readonly currentVersion: string;
  readonly bundleId: string;
  readonly platform: PlatformId;
  readonly bypassCache: boolean;
  readonly timeoutMs: number;
  readonly forceUpdateBelow: string | null;
  readonly rolloutPercentage: number;
  readonly rolloutBucket: number;
  /** Doc 06 §3 — device OS version, your own build channel, and configure()-time targeting rules, resolved into an effective forceUpdateBelow/rolloutPercentage before PolicyEngine runs. */
  readonly osVersion: string | null;
  readonly channel: string | null;
  readonly rules: readonly TargetingRule[];
}

export class CheckForUpdatesUseCase {
  constructor(private readonly deps: CheckForUpdatesUseCaseDeps) {}

  async execute(input: CheckForUpdatesInput): Promise<ActionPlan> {
    const remote = await this.deps.repository.getRemoteVersionInfo({
      currentVersion: input.currentVersion,
      bundleId: input.bundleId,
      platform: input.platform,
      bypassCache: input.bypassCache,
      timeoutMs: input.timeoutMs,
    });

    const currentParsed = this.deps.comparator.parse(input.currentVersion);
    const remoteParsed = this.deps.comparator.parse(remote.latestVersion);

    const effectivePolicy = resolveEffectivePolicy(
      input.rules,
      { osVersion: input.osVersion, channel: input.channel },
      {
        forceUpdateBelow: input.forceUpdateBelow,
        rolloutPercentage: input.rolloutPercentage,
      },
      this.deps.comparator
    );
    const forceUpdateBelowParsed = effectivePolicy.forceUpdateBelow
      ? this.deps.comparator.parse(effectivePolicy.forceUpdateBelow)
      : null;
    const userDecision = await this.deps.repository.getUserDecision();

    const actionType = this.deps.policyEngine.evaluate({
      currentVersion: currentParsed,
      remoteVersion: remoteParsed,
      forceUpdateBelow: forceUpdateBelowParsed,
      userDecision,
      now: this.deps.clock.now(),
      rolloutPercentage: effectivePolicy.rolloutPercentage,
      rolloutBucket: input.rolloutBucket,
    });

    return this.deps.decisionEngine.buildActionPlan(
      actionType,
      input.currentVersion,
      remote
    );
  }
}
