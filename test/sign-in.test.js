import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/[[path]].js';

const env = { SITE_URL: 'https://site.example', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key' };
const request = data => new Request(`${env.SITE_URL}/api/auth/request-code`, { method: 'POST', headers: { Origin: env.SITE_URL, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

test('unrecognized emails and database failures never issue an OTP', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  for (const databaseResponse of [Response.json(false), Response.json({ code: 'P0001', message: 'Lookup failed' }, { status: 409 })]) {
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(String(url), `${env.SUPABASE_URL}/rest/v1/rpc/request_sign_in`);
      assert.deepEqual(JSON.parse(options.body), { p_email: 'unknown@example.com', p_purpose: 'tickets', p_token_hash: null });
      return databaseResponse;
    };
    const response = await onRequest({ request: request({ email: 'Unknown@Example.com' }), env });
    assert.equal(response.status, databaseResponse.ok ? 403 : 409);
    assert.equal(calls, 1);
    assert.ok(!(await response.text()).includes(env.SUPABASE_SERVICE_ROLE_KEY));
  }
});

test('eligible emails receive a code only after the database check', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    if (calls.length === 1) {
      assert.equal(String(url), `${env.SUPABASE_URL}/rest/v1/rpc/request_sign_in`);
      return Response.json(true);
    }
    assert.equal(String(url), `${env.SUPABASE_URL}/auth/v1/otp`);
    assert.deepEqual(JSON.parse(options.body), { email: 'holder@example.com', create_user: true });
    return Response.json({});
  };
  const response = await onRequest({ request: request({ email: ' Holder@Example.com ', purpose: 'tickets' }), env });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { sent: true }); assert.equal(calls.length, 2);
});

test('transfer sign-in requires a valid token and passes only its hash to the database', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(String(url), `${env.SUPABASE_URL}/rest/v1/rpc/request_sign_in`);
    const data = JSON.parse(options.body); assert.equal(data.p_purpose, 'transfer'); assert.match(data.p_token_hash, /^[a-f0-9]{64}$/);
    return Response.json(false);
  };
  assert.equal((await onRequest({ request: request({ email: 'invitee@example.com', purpose: 'transfer' }), env })).status, 400);
  assert.equal(calls, 0);
  const token = crypto.randomUUID() + crypto.randomUUID();
  assert.equal((await onRequest({ request: request({ email: 'invitee@example.com', purpose: 'transfer', transferToken: token }), env })).status, 403);
  assert.equal(calls, 1);
});

test('OTP errors preserve rate limits and cross-origin requests cannot send codes', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  let calls = 0;
  globalThis.fetch = async url => { calls++; return String(url).endsWith('/request_sign_in') ? Response.json(true) : Response.json({}, { status: 429 }); };
  const response = await onRequest({ request: request({ email: 'holder@example.com' }), env });
  assert.equal(response.status, 429); assert.equal(calls, 2);
  const foreign = request({ email: 'holder@example.com' }); foreign.headers.set('Origin', 'https://evil.example');
  assert.equal((await onRequest({ request: foreign, env })).status, 403); assert.equal(calls, 2);
});
