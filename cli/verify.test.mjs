#!/usr/bin/env node

// Standalone smoke test for cli/verify.mjs — deliberately NOT run by `yarn test`
// (Jest). Jest runs before `yarn prepare`/`bob build` in CI (see CLAUDE.md's CI order),
// but this CLI statically imports lib/module/data/config/{ConfigDocumentValidator,
// canonicalize}.js (see verify.mjs's top-of-file comment for why), so it can only run
// once lib/ has been built. Run manually with `yarn prepare && node cli/verify.test.mjs`.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHmac, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalize } from '../lib/module/data/config/canonicalize.js';

const CLI = fileURLToPath(new URL('./verify.mjs', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'version-check-cli-test-'));

function run(args) {
  // Pass/fail lines are split across stdout (console.log) and stderr (console.error) in
  // verify.mjs — combine both so assertions don't need to know which stream a given
  // line landed on, same as reading the CLI's terminal output would show.
  const result = spawnSync('node', [CLI, ...args], { encoding: 'utf8' });
  return { code: result.status, output: (result.stdout ?? '') + (result.stderr ?? '') };
}

function writeEnvelope(name, envelope) {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(envelope));
  return path;
}

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`✔ ${name}`);
  } catch (error) {
    failures++;
    console.error(`✖ ${name}`);
    console.error(error);
  }
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicKeyBase64 = publicKey
  .export({ format: 'jwk' })
  .x.replace(/-/g, '+')
  .replace(/_/g, '/');

const payload = { alerts: { forceUpdateBelow: '2.0.0' }, schemaVersion: '1.0' };
const message = Buffer.from(canonicalize(payload), 'utf8');
const ed25519Signature = sign(null, message, privateKey).toString('base64');

const validEnvelope = {
  schemaVersion: '1.0',
  payload,
  signature: {
    algorithm: 'ed25519',
    keyId: 'k1',
    value: ed25519Signature,
    signedAt: new Date().toISOString(),
  },
};

test('valid envelope, no key supplied -> passes structural checks, exit 0', () => {
  const path = writeEnvelope('valid.json', validEnvelope);
  const { code, output } = run(['verify', '--config', path]);
  assert.equal(code, 0);
  assert.match(output, /Schema validation passed/);
  assert.match(output, /Signature not verified/);
});

test('valid envelope, correct ed25519 public key -> signature verified, exit 0', () => {
  const path = writeEnvelope('valid2.json', validEnvelope);
  const { code, output } = run([
    'verify',
    '--config',
    path,
    '--public-key',
    publicKeyBase64,
  ]);
  assert.equal(code, 0);
  assert.match(output, /Signature verified \(ed25519\)/);
});

test('tampered payload with the correct key -> signature verification fails, exit 1', () => {
  const tampered = {
    ...validEnvelope,
    payload: { ...payload, alerts: { forceUpdateBelow: '9.9.9' } },
  };
  const path = writeEnvelope('tampered.json', tampered);
  const { code, output } = run([
    'verify',
    '--config',
    path,
    '--public-key',
    publicKeyBase64,
  ]);
  assert.equal(code, 1);
  assert.match(output, /Signature verification failed/);
});

test('wrong public key -> signature verification fails, exit 1', () => {
  const path = writeEnvelope('valid3.json', validEnvelope);
  const wrongKey = generateKeyPairSync('ed25519')
    .publicKey.export({ format: 'jwk' })
    .x.replace(/-/g, '+')
    .replace(/_/g, '/');
  const { code } = run(['verify', '--config', path, '--public-key', wrongKey]);
  assert.equal(code, 1);
});

test('hmac-sha256 round trip', () => {
  const secret = 'shared-secret';
  const mac = createHmac('sha256', secret).update(message).digest('base64');
  const envelope = {
    schemaVersion: '1.0',
    payload,
    signature: {
      algorithm: 'hmac-sha256',
      keyId: 'k1',
      value: mac,
      signedAt: new Date().toISOString(),
    },
  };
  const path = writeEnvelope('hmac.json', envelope);

  const good = run(['verify', '--config', path, '--hmac-secret', secret]);
  assert.equal(good.code, 0);
  assert.match(good.output, /Signature verified \(hmac-sha256\)/);

  const bad = run(['verify', '--config', path, '--hmac-secret', 'wrong']);
  assert.equal(bad.code, 1);
});

test('malformed document -> schema/boundary errors reported, exit 1', () => {
  const path = join(dir, 'bad.json');
  writeFileSync(
    path,
    JSON.stringify({ payload: { alerts: { forceUpdateBelow: 'not-semver' } } })
  );
  const { code, output } = run(['verify', '--config', path]);
  assert.equal(code, 1);
  assert.match(output, /Schema validation failed/);
  assert.match(output, /not a valid SemVer string/);
});

test('missing file -> exit 1', () => {
  const { code, output } = run(['verify', '--config', join(dir, 'missing.json')]);
  assert.equal(code, 1);
  assert.match(output ?? '', /Could not read/);
});

test('--help prints usage, exit 0', () => {
  const { code, output } = run(['--help']);
  assert.equal(code, 0);
  assert.match(output, /Usage: version-check verify/);
});

rmSync(dir, { recursive: true, force: true });

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll cli/verify.mjs smoke tests passed');
