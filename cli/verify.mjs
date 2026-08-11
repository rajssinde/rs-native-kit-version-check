#!/usr/bin/env node

// CLI verifier (doc 06 §6) — validates a signed remote-config document (doc 03) before
// deploying it, without needing a device/simulator. Deliberately imports the *compiled*
// lib/module output (built by `bob build`, see package.json's `prepare` script) rather
// than duplicating ConfigDocumentValidator/canonicalize by hand — that guarantees this
// CLI can never silently drift from what the library itself actually validates/signs.
// Zero npm dependencies: argument parsing and output formatting are hand-rolled, and
// signature verification uses Node's builtin `crypto` (this is the one context in the
// whole project where JS-side crypto is appropriate — the app itself never does this,
// per SignatureVerifier.ts's OS-crypto-only rule; a local CLI has no such constraint and
// no ICryptoProvider/native bridge to call into).

import { readFileSync } from 'node:fs';
import { createHmac, createPublicKey, timingSafeEqual, verify as cryptoVerify } from 'node:crypto';
import {
  CONFIG_ENVELOPE_MAX_BYTES,
  ConfigDocumentValidator,
} from '../lib/module/data/config/ConfigDocumentValidator.js';
import { canonicalize } from '../lib/module/data/config/canonicalize.js';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(arg);
    }
  }
  return args;
}

function printUsage() {
  console.log(`Usage: version-check verify --config <path> [--public-key <base64>] [--hmac-secret <string>]

  --config <path>        Path to a signed config envelope JSON file (doc 03 §3.1 SignedConfigEnvelope).
  --public-key <base64>  Raw 32-byte Ed25519 public key, base64-encoded. Verifies signature.algorithm "ed25519".
  --hmac-secret <string> The shared HMAC secret. Verifies signature.algorithm "hmac-sha256".

Without --public-key/--hmac-secret, only schema/shape validation runs — the signature
itself is not checked (this CLI never has access to the key material embedded in your
compiled app, see docs/architecture/06-....md §6).`);
}

function base64ToBase64Url(b64) {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function verifyEd25519(message, signatureBase64, publicKeyBase64) {
  const publicKey = createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: base64ToBase64Url(publicKeyBase64) },
    format: 'jwk',
  });
  return cryptoVerify(null, message, publicKey, Buffer.from(signatureBase64, 'base64'));
}

function verifyHmacSha256(message, macBase64, secret) {
  const computed = createHmac('sha256', secret).update(message).digest();
  const expected = Buffer.from(macBase64, 'base64');
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

function runVerify(args) {
  const configPath = args.config;
  if (typeof configPath !== 'string') {
    console.error('Missing required --config <path>.\n');
    printUsage();
    return 1;
  }

  let raw;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch (error) {
    console.error(`✖ Could not read "${configPath}": ${error.message}`);
    return 1;
  }

  let ok = true;
  const sizeBytes = Buffer.byteLength(raw, 'utf8');
  if (sizeBytes > CONFIG_ENVELOPE_MAX_BYTES) {
    console.error(
      `✖ Envelope is ${sizeBytes} bytes, exceeds the ${CONFIG_ENVELOPE_MAX_BYTES}-byte limit`
    );
    ok = false;
  } else {
    console.log(`✔ Envelope size (${sizeBytes} bytes) within limit`);
  }

  const validator = new ConfigDocumentValidator();

  const schemaResult = validator.validateSchema(raw);
  if (schemaResult.valid) {
    console.log('✔ Schema validation passed');
  } else {
    ok = false;
    console.error('✖ Schema validation failed:');
    for (const error of schemaResult.errors) console.error(`    - ${error}`);
  }

  const boundaryResult = validator.validateBoundaries(raw);
  if (boundaryResult.valid) {
    console.log('✔ Boundary/field validation passed (SemVer fields, URL schemes, store id shapes, ...)');
  } else {
    ok = false;
    console.error('✖ Boundary/field validation failed:');
    for (const [field, reason] of boundaryResult.fieldErrors) {
      console.error(`    - ${field}: ${reason}`);
    }
  }

  if (!schemaResult.valid) {
    // Can't safely parse further — the whole-document fallback rule (doc 03 §7.3) would
    // apply here too, so there's nothing meaningful left to check.
    return ok ? 0 : 1;
  }

  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch (error) {
    console.error(`✖ Envelope is not valid JSON: ${error.message}`);
    return 1;
  }

  const { algorithm, value } = envelope.signature ?? {};
  const publicKey = args['public-key'];
  const hmacSecret = args['hmac-secret'];

  if (algorithm === 'none') {
    console.log(
      'ℹ signature.algorithm is "none" — no signature to verify (only valid for local/dev documents; a real app rejects this outside dev builds)'
    );
  } else if (typeof publicKey !== 'string' && typeof hmacSecret !== 'string') {
    console.log(
      `ℹ Signature not verified — pass --public-key or --hmac-secret to check the "${algorithm}" signature`
    );
  } else {
    const message = Buffer.from(canonicalize(envelope.payload), 'utf8');
    try {
      let signatureValid;
      if (algorithm === 'ed25519') {
        if (typeof publicKey !== 'string') {
          throw new Error('signature.algorithm is "ed25519" — pass --public-key, not --hmac-secret');
        }
        signatureValid = verifyEd25519(message, value, publicKey);
      } else if (algorithm === 'hmac-sha256') {
        if (typeof hmacSecret !== 'string') {
          throw new Error('signature.algorithm is "hmac-sha256" — pass --hmac-secret, not --public-key');
        }
        signatureValid = verifyHmacSha256(message, value, hmacSecret);
      } else {
        throw new Error(`Unrecognized signature.algorithm "${algorithm}"`);
      }

      if (signatureValid) {
        console.log(`✔ Signature verified (${algorithm})`);
      } else {
        ok = false;
        console.error(`✖ Signature verification failed (${algorithm}) — payload does not match signature.value`);
      }
    } catch (error) {
      ok = false;
      console.error(`✖ ${error.message}`);
    }
  }

  return ok ? 0 : 1;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  if (command !== 'verify') {
    printUsage();
    process.exit(command === undefined ? 1 : 1);
  }

  process.exit(runVerify(args));
}

main();
