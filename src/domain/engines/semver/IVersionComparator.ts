import type { ParsedVersion } from '../../models/ParsedVersion';

export interface IVersionComparator {
  parse(raw: string): ParsedVersion;
  compare(a: ParsedVersion, b: ParsedVersion): -1 | 0 | 1;
  satisfies(version: ParsedVersion, range: string): boolean;
}
