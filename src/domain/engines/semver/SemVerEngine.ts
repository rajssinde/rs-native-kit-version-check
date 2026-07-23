import { InvalidVersionFormatException } from '../../errors/VersionManagerException';
import type { ParsedVersion } from '../../models/ParsedVersion';
import type { IVersionComparator } from './IVersionComparator';

/**
 * Zero-dependency SemVer 2.0.0 parser/comparator (Prompt 1 §9.3 — no `semver` package).
 * Supports the full strict grammar plus a small set of common looseness (leading "v",
 * 1 or 2 part versions). Range support covers "^", "~", the comparison operators, and
 * whitespace-separated AND clauses — OR ("||") ranges and prerelease-scoped range
 * matching are intentionally out of scope for this pass; see Prompt 5 in the design
 * series for the full BNF grammar and edge-case matrix this should eventually match.
 */

const STRICT_SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

const LOOSE_VERSION_REGEX = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\..*)?$/;

function toIdentifiers(segment: string | undefined): (string | number)[] {
  if (!segment) return [];
  return segment.split('.').map((part) => {
    return /^\d+$/.test(part) ? Number(part) : part;
  });
}

export function parseVersion(raw: string): ParsedVersion {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new InvalidVersionFormatException({
      message: `Cannot parse version: expected a non-empty string, received "${String(raw)}"`,
      metadata: { raw },
    });
  }

  const trimmed = raw.trim().replace(/^[vV]/, '');
  const strict = STRICT_SEMVER_REGEX.exec(trimmed);
  if (strict) {
    const [, majorStr, minorStr, patchStr, prerelease, build] = strict;
    return {
      raw,
      major: Number(majorStr),
      minor: Number(minorStr),
      patch: Number(patchStr),
      prerelease: toIdentifiers(prerelease),
      build: build ? build.split('.') : [],
    };
  }

  const loose = LOOSE_VERSION_REGEX.exec(trimmed);
  if (loose) {
    const [, majorStr, minorStr, patchStr] = loose;
    return {
      raw,
      major: Number(majorStr),
      minor: minorStr !== undefined ? Number(minorStr) : 0,
      patch: patchStr !== undefined ? Number(patchStr) : 0,
      prerelease: [],
      build: [],
    };
  }

  throw new InvalidVersionFormatException({
    message: `Cannot parse version: "${raw}" does not match a recognized SemVer format`,
    metadata: { raw },
  });
}

function comparePrerelease(
  a: readonly (string | number)[],
  b: readonly (string | number)[]
): -1 | 0 | 1 {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1; // no prerelease outranks any prerelease
  if (b.length === 0) return -1;

  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i];
    const bi = b[i];
    if (ai === undefined) return -1; // shorter set of identifiers = lower precedence
    if (bi === undefined) return 1;
    if (ai === bi) continue;

    const aIsNumber = typeof ai === 'number';
    const bIsNumber = typeof bi === 'number';
    if (aIsNumber && bIsNumber) return ai < bi ? -1 : 1;
    if (aIsNumber && !bIsNumber) return -1; // numeric identifiers always have lower precedence
    if (!aIsNumber && bIsNumber) return 1;
    return String(ai) < String(bi) ? -1 : 1;
  }
  return 0;
}

export function compareVersions(
  a: ParsedVersion,
  b: ParsedVersion
): -1 | 0 | 1 {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return comparePrerelease(a.prerelease, b.prerelease);
}

function bumpUpperBound(
  base: ParsedVersion,
  kind: 'caret' | 'tilde'
): ParsedVersion {
  if (kind === 'tilde') {
    return {
      ...base,
      minor: base.minor + 1,
      patch: 0,
      prerelease: [],
      build: [],
    };
  }
  if (base.major > 0) {
    return {
      ...base,
      major: base.major + 1,
      minor: 0,
      patch: 0,
      prerelease: [],
      build: [],
    };
  }
  if (base.minor > 0) {
    return {
      ...base,
      minor: base.minor + 1,
      patch: 0,
      prerelease: [],
      build: [],
    };
  }
  return { ...base, patch: base.patch + 1, prerelease: [], build: [] };
}

function satisfiesClause(version: ParsedVersion, clause: string): boolean {
  const caretMatch = /^\^(.+)$/.exec(clause);
  const caretArg = caretMatch?.[1];
  if (caretArg) {
    const base = parseVersion(caretArg);
    const upper = bumpUpperBound(base, 'caret');
    return (
      compareVersions(version, base) >= 0 && compareVersions(version, upper) < 0
    );
  }

  const tildeMatch = /^~(.+)$/.exec(clause);
  const tildeArg = tildeMatch?.[1];
  if (tildeArg) {
    const base = parseVersion(tildeArg);
    const upper = bumpUpperBound(base, 'tilde');
    return (
      compareVersions(version, base) >= 0 && compareVersions(version, upper) < 0
    );
  }

  const opMatch = /^(>=|<=|>|<|=)?(.+)$/.exec(clause);
  const opArg = opMatch?.[2];
  if (opArg) {
    const operator = opMatch?.[1] ?? '=';
    const target = parseVersion(opArg);
    const cmp = compareVersions(version, target);
    switch (operator) {
      case '>=':
        return cmp >= 0;
      case '<=':
        return cmp <= 0;
      case '>':
        return cmp > 0;
      case '<':
        return cmp < 0;
      default:
        return cmp === 0;
    }
  }

  return false;
}

export function satisfiesRange(version: ParsedVersion, range: string): boolean {
  const clauses = range.trim().split(/\s+/).filter(Boolean);
  if (clauses.length === 0) return false;
  return clauses.every((clause) => satisfiesClause(version, clause));
}

export class SemVerEngine implements IVersionComparator {
  parse(raw: string): ParsedVersion {
    return parseVersion(raw);
  }

  compare(a: ParsedVersion, b: ParsedVersion): -1 | 0 | 1 {
    return compareVersions(a, b);
  }

  satisfies(version: ParsedVersion, range: string): boolean {
    return satisfiesRange(version, range);
  }
}
