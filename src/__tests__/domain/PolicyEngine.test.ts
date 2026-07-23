import { describe, expect, it } from '@jest/globals';
import { ActionType } from '../../domain/models/ActionPlan';
import { PolicyEngine } from '../../domain/engines/policy/PolicyEngine';
import {
  SemVerEngine,
  parseVersion,
} from '../../domain/engines/semver/SemVerEngine';
import type { PolicyEvaluationContext } from '../../domain/engines/policy/IUpdatePolicyEngine';

const comparator = new SemVerEngine();
const engine = new PolicyEngine(comparator);

function baseContext(
  overrides: Partial<PolicyEvaluationContext> = {}
): PolicyEvaluationContext {
  return {
    currentVersion: parseVersion('1.0.0'),
    remoteVersion: parseVersion('1.1.0'),
    forceUpdateBelow: null,
    userDecision: null,
    now: 1000,
    rolloutPercentage: 100,
    rolloutBucket: 0,
    ...overrides,
  };
}

describe('PolicyEngine', () => {
  it('returns NO_ACTION when current version is already up to date', () => {
    expect(
      engine.evaluate(
        baseContext({
          currentVersion: parseVersion('1.1.0'),
          remoteVersion: parseVersion('1.1.0'),
        })
      )
    ).toBe(ActionType.NO_ACTION);
  });

  it('returns FORCE_UPDATE when current version is below the force threshold', () => {
    expect(
      engine.evaluate(baseContext({ forceUpdateBelow: parseVersion('1.1.0') }))
    ).toBe(ActionType.FORCE_UPDATE);
  });

  it('returns NO_ACTION for an ignored version', () => {
    const context = baseContext({
      userDecision: { ignoredVersions: ['1.1.0'], remindMeLaterUntil: null },
    });
    expect(engine.evaluate(context)).toBe(ActionType.NO_ACTION);
  });

  it('returns NO_ACTION while inside an active remind-me-later window', () => {
    const context = baseContext({
      userDecision: { ignoredVersions: [], remindMeLaterUntil: 5000 },
      now: 1000,
    });
    expect(engine.evaluate(context)).toBe(ActionType.NO_ACTION);
  });

  it('returns OPTIONAL_REMINDER once a remind-me-later window has expired', () => {
    const context = baseContext({
      userDecision: { ignoredVersions: [], remindMeLaterUntil: 500 },
      now: 1000,
    });
    expect(engine.evaluate(context)).toBe(ActionType.OPTIONAL_REMINDER);
  });

  it('returns SOFT_UPDATE on first detection with no prior user decision', () => {
    expect(engine.evaluate(baseContext())).toBe(ActionType.SOFT_UPDATE);
  });

  it('returns NO_ACTION when the device rollout bucket is outside the rollout percentage', () => {
    expect(
      engine.evaluate(baseContext({ rolloutPercentage: 10, rolloutBucket: 50 }))
    ).toBe(ActionType.NO_ACTION);
  });
});
