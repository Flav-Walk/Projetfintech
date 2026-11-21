/// <reference types="node" />
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { exchangeAuthCode, isRecoveryCallback, readAuthCallbackUrl } from '../src/lib/auth-callback';
import { authErrorMessage } from '../src/lib/auth-errors';
import { installPkceCrypto } from '../src/lib/pkce-crypto';

test('PKCE native adapter: Supabase sends S256 for signup and recovery', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')!;
  const nativeRuntime: { crypto?: Crypto } = {};
  let digests = 0;
  installPkceCrypto(nativeRuntime, {
    getRandomValues: webcrypto.getRandomValues.bind(webcrypto) as Crypto['getRandomValues'],
    digest: async (algorithm, data) => {
      digests++;
      return webcrypto.subtle.digest(algorithm, data);
    },
  });
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: nativeRuntime.crypto });
  const storage = new Map<string, string>();
  const requests: { url: string; body: Record<string, string> }[] = [];
  const client = createClient('https://auth.test.local', 'public-test-key', {
    auth: {
      flowType: 'pkce', autoRefreshToken: false, detectSessionInUrl: false,
      storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => { storage.set(k, v); }, removeItem: (k) => { storage.delete(k); } },
    },
    global: { fetch: async (url, init) => {
      requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ code: 'unexpected_failure', msg: 'Error sending confirmation email' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  try {
    const result = await client.auth.signUp({ email: 'person@test.local', password: 'Test-Password-123', options: { emailRedirectTo: 'complice://auth/callback' } });
    assert.equal(result.error?.status, 500);
    await client.auth.resetPasswordForEmail('person@test.local', { redirectTo: 'complice://auth/callback' });
    assert.equal(requests.length, 2, 'no automatic signup retries');
    assert.equal(digests, 2, 'both requests used native digest');
    for (const request of requests) {
      assert.equal(request.body.code_challenge_method, 's256');
      assert.match(request.body.code_challenge, /^[A-Za-z0-9_-]{43}$/);
    }
    assert.match(requests[0].url, /\/signup\?/);
    assert.match(requests[1].url, /\/recover\?/);
  } finally {
    client.auth.stopAutoRefresh();
    Object.defineProperty(globalThis, 'crypto', original);
  }
});

test('native digest matches RFC 7636 S256 vector; rejects unsupported algorithms', async () => {
  const runtime: { crypto?: Crypto } = {};
  installPkceCrypto(runtime, {
    getRandomValues: webcrypto.getRandomValues.bind(webcrypto) as Crypto['getRandomValues'],
    digest: (algorithm, data) => webcrypto.subtle.digest(algorithm, data),
  });
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const result = await runtime.crypto!.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  assert.equal(Buffer.from(result).toString('base64url'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  assert.equal(Buffer.from(result).toString('hex'), createHash('sha256').update(verifier).digest('hex'));
  await assert.rejects(runtime.crypto!.subtle.digest('SHA-1', new Uint8Array()), /Unsupported/);
});

test('browser WebCrypto remains intact', () => {
  const runtime = { crypto: globalThis.crypto };
  const digest = runtime.crypto.subtle.digest;
  installPkceCrypto(runtime, { getRandomValues: () => { throw Error('native called on web'); }, digest: async () => { throw Error('native called on web'); } });
  assert.equal(runtime.crypto, globalThis.crypto);
  assert.equal(runtime.crypto.subtle.digest, digest);
});

test('callback carries flow id and recognizes recovery without type query parameter', async () => {
  const calls: unknown[][] = [];
  const auth = { exchangeCodeForSession: async (...args: unknown[]) => { calls.push(args); return {}; } };
  await exchangeAuthCode(auth as never, 'one-time-code', 'native-flow-id');
  assert.deepEqual(calls, [['one-time-code', { flowId: 'native-flow-id' }]]);
  assert.equal(isRecoveryCallback({ redirectType: 'recovery' }), true);
  assert.equal(isRecoveryCallback({}, 'recovery'), true);
  assert.equal(isRecoveryCallback({}), false);
});

test('Auth errors are actionable and never expose server internals', () => {
  const smtp = authErrorMessage({ status: 500, code: 'unexpected_failure', message: 'Error sending confirmation email: smtp secret=hidden' });
  assert.match(smtp, /confirmation.*envoyé/);
  assert.doesNotMatch(smtp, /smtp|hidden/);
  const db = authErrorMessage({ status: 500, message: 'Database error saving new user: relation private.secret_table' });
  assert.match(db, /service de comptes/);
  assert.doesNotMatch(db, /relation|secret_table/);
  assert.match(authErrorMessage({ code: 'otp_expired', message: 'Email link is invalid or has expired' }), /expiré/);
});

test('expired callback fragment and invitation query are both recovered', () => {
  const params = readAuthCallbackUrl('complice://auth/callback?invite=abc#' + new URLSearchParams({ error: 'access_denied', error_code: 'otp_expired', error_description: 'internal detail' }));
  assert.equal(params.invite, 'abc');
  assert.equal(params.error_code, 'otp_expired');
  assert.deepEqual(readAuthCallbackUrl(null), {});
  assert.deepEqual(readAuthCallbackUrl('not a URL'), {});
});
