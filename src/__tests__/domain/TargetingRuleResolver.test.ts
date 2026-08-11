import { describe, expect, it } from '@jest/globals';
import { resolveEffectivePolicy } from '../../domain/engines/policy/TargetingRuleResolver';
import { SemVerEngine } from '../../domain/engines/semver/SemVerEngine';
import type { TargetingRule } from '../../domain/models/VersionManagerOptions';

const comparator = new SemVerEngine();
const defaults = { forceUpdateBelow: '1.0.0', rolloutPercentage: 100 };

describe('resolveEffectivePolicy (doc 06 §3)', () => {
  it('falls back to defaults when there are no rules', () => {
    const result = resolveEffectivePolicy(
      [],
      { osVersion: '17.0', channel: 'prod' },
      defaults,
      comparator
    );
    expect(result).toEqual(defaults);
  });

  it('matches a channel-only rule and overrides forceUpdateBelow', () => {
    const rules: TargetingRule[] = [
      { channel: 'beta', forceUpdateBelow: '3.1.0' },
    ];

    const matched = resolveEffectivePolicy(
      rules,
      { osVersion: null, channel: 'beta' },
      defaults,
      comparator
    );
    expect(matched.forceUpdateBelow).toBe('3.1.0');

    const unmatched = resolveEffectivePolicy(
      rules,
      { osVersion: null, channel: 'prod' },
      defaults,
      comparator
    );
    expect(unmatched).toEqual(defaults);
  });

  it('matches a minOsVersion rule when the device OS is at or above the floor', () => {
    const rules: TargetingRule[] = [
      { minOsVersion: '17.0', forceUpdateBelow: '3.0.0' },
    ];

    expect(
      resolveEffectivePolicy(
        rules,
        { osVersion: '17.2', channel: null },
        defaults,
        comparator
      ).forceUpdateBelow
    ).toBe('3.0.0');

    expect(
      resolveEffectivePolicy(
        rules,
        { osVersion: '16.4', channel: null },
        defaults,
        comparator
      )
    ).toEqual(defaults);
  });

  it('requires every clause a rule specifies to match (AND, not OR)', () => {
    const rules: TargetingRule[] = [
      { minOsVersion: '17.0', channel: 'beta', forceUpdateBelow: '3.0.0' },
    ];

    // OS matches but channel doesn't -> no match.
    expect(
      resolveEffectivePolicy(
        rules,
        { osVersion: '17.0', channel: 'prod' },
        defaults,
        comparator
      )
    ).toEqual(defaults);
  });

  it('never matches a minOsVersion rule when the device OS version is unknown (null)', () => {
    const rules: TargetingRule[] = [
      { minOsVersion: '17.0', forceUpdateBelow: '3.0.0' },
    ];

    expect(
      resolveEffectivePolicy(
        rules,
        { osVersion: null, channel: null },
        defaults,
        comparator
      )
    ).toEqual(defaults);
  });

  it('is first-match-wins across multiple rules', () => {
    const rules: TargetingRule[] = [
      { channel: 'beta', forceUpdateBelow: '3.1.0-beta.2' },
      { channel: 'beta', forceUpdateBelow: '9.9.9' },
    ];

    const result = resolveEffectivePolicy(
      rules,
      { osVersion: null, channel: 'beta' },
      defaults,
      comparator
    );
    expect(result.forceUpdateBelow).toBe('3.1.0-beta.2');
  });

  it("falls back to the matched rule's own defaults per-field when the rule omits a field", () => {
    const rules: TargetingRule[] = [{ channel: 'beta', rolloutPercentage: 10 }];

    const result = resolveEffectivePolicy(
      rules,
      { osVersion: null, channel: 'beta' },
      defaults,
      comparator
    );
    expect(result.rolloutPercentage).toBe(10);
    expect(result.forceUpdateBelow).toBe(defaults.forceUpdateBelow);
  });
});
