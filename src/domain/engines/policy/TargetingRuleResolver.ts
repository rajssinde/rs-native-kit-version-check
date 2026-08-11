import type { TargetingRule } from '../../models/VersionManagerOptions';
import type { IVersionComparator } from '../semver/IVersionComparator';

export interface TargetingContext {
  readonly osVersion: string | null;
  readonly channel: string | null;
}

export interface EffectivePolicy {
  readonly forceUpdateBelow: string | null;
  readonly rolloutPercentage: number;
}

/**
 * Doc 06 §3 — first-match-wins rule resolution, run before PolicyEngine.evaluate() so
 * PolicyEngine itself keeps evaluating the same flat forceUpdateBelow/rolloutPercentage
 * shape it always has; this is a pre-processing step (same split as DecisionEngine vs
 * PolicyEngine), not a change to rule evaluation itself. A rule matches when every
 * clause it specifies matches; an omitted clause matches anything. No matching rule (or
 * an empty rules list) falls back to `defaults` unchanged.
 */
export function resolveEffectivePolicy(
  rules: readonly TargetingRule[],
  context: TargetingContext,
  defaults: EffectivePolicy,
  comparator: IVersionComparator
): EffectivePolicy {
  for (const rule of rules) {
    if (rule.channel !== undefined && rule.channel !== context.channel) {
      continue;
    }
    if (rule.minOsVersion !== undefined) {
      if (context.osVersion === null) continue;
      const matchesFloor =
        comparator.compare(
          comparator.parse(context.osVersion),
          comparator.parse(rule.minOsVersion)
        ) >= 0;
      if (!matchesFloor) continue;
    }

    return {
      forceUpdateBelow: rule.forceUpdateBelow ?? defaults.forceUpdateBelow,
      rolloutPercentage: rule.rolloutPercentage ?? defaults.rolloutPercentage,
    };
  }
  return defaults;
}
