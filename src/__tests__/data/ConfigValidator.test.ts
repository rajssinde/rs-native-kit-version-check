import { describe, expect, it } from '@jest/globals';
import { validateOptions } from '../../data/config/ConfigValidator';
import { InvalidConfigException } from '../../domain/errors/VersionManagerException';
import type { VersionManagerOptions } from '../../domain/models/VersionManagerOptions';

const base: VersionManagerOptions = {
  stores: { custom: { url: 'https://example.com/version.json' } },
};

describe('validateOptions — policy.rules (doc 06 §3)', () => {
  it('accepts a well-formed rules array', () => {
    expect(() =>
      validateOptions({
        ...base,
        policy: {
          rules: [
            {
              minOsVersion: '17.0',
              channel: 'beta',
              forceUpdateBelow: '3.0.0',
            },
            { rolloutPercentage: 50 },
          ],
        },
      })
    ).not.toThrow();
  });

  it('rejects a rule with a malformed forceUpdateBelow', () => {
    expect(() =>
      validateOptions({
        ...base,
        policy: { rules: [{ forceUpdateBelow: 'not-a-version' }] },
      })
    ).toThrow(InvalidConfigException);
  });

  it('rejects a rule with a malformed minOsVersion', () => {
    expect(() =>
      validateOptions({
        ...base,
        policy: { rules: [{ minOsVersion: 'not-a-version' }] },
      })
    ).toThrow(InvalidConfigException);
  });

  it('rejects a rule with an out-of-range rolloutPercentage', () => {
    expect(() =>
      validateOptions({
        ...base,
        policy: { rules: [{ rolloutPercentage: 150 }] },
      })
    ).toThrow(InvalidConfigException);
  });
});
