import { describe, expect, it } from '@jest/globals';
import { InvalidVersionFormatException } from '../../domain/errors/VersionManagerException';
import {
  compareVersions,
  parseVersion,
  satisfiesRange,
} from '../../domain/engines/semver/SemVerEngine';

describe('SemVerEngine.parseVersion', () => {
  it('parses a standard major.minor.patch version', () => {
    const parsed = parseVersion('1.2.3');
    expect(parsed).toMatchObject({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: [],
      build: [],
    });
  });

  it('parses a leading "v" prefix', () => {
    expect(parseVersion('v2.0.0')).toMatchObject({
      major: 2,
      minor: 0,
      patch: 0,
    });
  });

  it('parses pre-release and build metadata', () => {
    const parsed = parseVersion('1.0.0-beta.2+build.345');
    expect(parsed.prerelease).toEqual(['beta', 2]);
    expect(parsed.build).toEqual(['build', '345']);
  });

  it('loosely parses a 2-part version', () => {
    expect(parseVersion('1.0')).toMatchObject({ major: 1, minor: 0, patch: 0 });
  });

  it('loosely parses a 4-part version by ignoring the extra segment', () => {
    expect(parseVersion('1.0.0.0')).toMatchObject({
      major: 1,
      minor: 0,
      patch: 0,
    });
  });

  it('throws InvalidVersionFormatException for garbage input', () => {
    expect(() => parseVersion('not-a-version')).toThrow(
      InvalidVersionFormatException
    );
  });

  it('throws InvalidVersionFormatException for an empty string', () => {
    expect(() => parseVersion('')).toThrow(InvalidVersionFormatException);
  });
});

describe('SemVerEngine.compareVersions', () => {
  it('orders by major, then minor, then patch', () => {
    expect(compareVersions(parseVersion('2.0.0'), parseVersion('1.9.9'))).toBe(
      1
    );
    expect(compareVersions(parseVersion('1.2.0'), parseVersion('1.3.0'))).toBe(
      -1
    );
    expect(compareVersions(parseVersion('1.2.3'), parseVersion('1.2.3'))).toBe(
      0
    );
  });

  it('treats a release as higher precedence than its own pre-release', () => {
    expect(
      compareVersions(parseVersion('1.0.0'), parseVersion('1.0.0-alpha'))
    ).toBe(1);
  });

  it('orders pre-release identifiers per SemVer precedence rules', () => {
    // 1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta < 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0
    const ordered = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
    ].map(parseVersion);

    for (let i = 0; i < ordered.length - 1; i++) {
      expect(compareVersions(ordered[i]!, ordered[i + 1]!)).toBe(-1);
    }
  });
});

describe('SemVerEngine.satisfiesRange', () => {
  it('supports caret ranges', () => {
    expect(satisfiesRange(parseVersion('1.2.4'), '^1.2.3')).toBe(true);
    expect(satisfiesRange(parseVersion('2.0.0'), '^1.2.3')).toBe(false);
    expect(satisfiesRange(parseVersion('0.2.5'), '^0.2.3')).toBe(true);
    expect(satisfiesRange(parseVersion('0.3.0'), '^0.2.3')).toBe(false);
  });

  it('supports tilde ranges', () => {
    expect(satisfiesRange(parseVersion('1.2.9'), '~1.2.3')).toBe(true);
    expect(satisfiesRange(parseVersion('1.3.0'), '~1.2.3')).toBe(false);
  });

  it('supports comparison operators and AND clauses', () => {
    expect(satisfiesRange(parseVersion('1.5.0'), '>=1.0.0 <2.0.0')).toBe(true);
    expect(satisfiesRange(parseVersion('2.0.0'), '>=1.0.0 <2.0.0')).toBe(false);
  });
});
