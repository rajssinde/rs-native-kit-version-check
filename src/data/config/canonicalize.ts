/**
 * Hand-rolled canonicalizer (Prompt 1 §9.3 zero-dependency constraint), implementing the
 * same principles as RFC 8785 (JSON Canonicalization Scheme) that doc 03 §3.3 calls for:
 * recursive key sorting by UTF-16 code unit order, fixed number formatting, no
 * insignificant whitespace. Signatures are computed/verified over this canonical byte
 * form so that whitespace/key-order differences in transit never invalidate a
 * legitimately signed document.
 */

type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function canonicalizeValue(value: JsonValue): string {
  if (value === null) return 'null';

  if (typeof value === 'boolean') return value ? 'true' : 'false';

  if (typeof value === 'number') return canonicalizeNumber(value);

  if (typeof value === 'string') return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeValue).join(',')}]`;
  }

  // Recursive key sorting, UTF-16 code unit order (default JS string `<` comparison).
  const keys = Object.keys(value).sort();
  const members = keys.map(
    (key) =>
      `${JSON.stringify(key)}:${canonicalizeValue(value[key] as JsonValue)}`
  );
  return `{${members.join(',')}}`;
}

/**
 * Fixed number formatting per RFC 8785 §3.2.2.3 (simplified): integers render without a
 * decimal point/exponent; this codebase's config schema (doc 03 §6) only ever contains
 * integers and no fractional/exponential numeric fields, so the full ECMA-262
 * Number::toString algorithm RFC 8785 mandates is unnecessary here.
 */
function canonicalizeNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error('Cannot canonicalize a non-finite number');
  }
  if (Number.isInteger(value)) return String(value);
  return String(value);
}

/** Canonical byte sequence (as a UTF-8 string) for the given JSON-compatible value. */
export function canonicalize(value: unknown): string {
  return canonicalizeValue(value as JsonValue);
}

/** Base64 encoding of the UTF-8 bytes of a string, without relying on Node's Buffer. */
export function utf8ToBase64(input: string): string {
  if (typeof btoa === 'function' && typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(input);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i] as number);
    }
    return btoa(binary);
  }
  // React Native's Hermes engine provides global Buffer via a polyfill in most RN
  // setups, but not guaranteed — fall back to a minimal hand-rolled base64 encoder.
  return manualUtf8ToBase64(input);
}

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function manualUtf8ToBase64(input: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let code = input.codePointAt(i) as number;
    if (code > 0xffff) i++; // consumed a surrogate pair
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }

  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] as number;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    output += BASE64_CHARS[b0 >> 2];
    output += BASE64_CHARS[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    output +=
      b1 === undefined
        ? '='
        : BASE64_CHARS[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    output += b2 === undefined ? '=' : BASE64_CHARS[b2 & 0x3f];
  }
  return output;
}
