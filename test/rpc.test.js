import test from 'node:test';
import assert from 'node:assert/strict';
import { rpc } from '../functions/lib/core.js';
import { onRequest } from '../functions/api/[[path]].js';
const env = {
  APP_ENV: 'local',
  SITE_URL: 'http://127.0.0.1:8788',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service',
};
test('RPC accepts actual 204 responses, empty successes and JSON results', async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  for (const [response, expected] of [
    [new Response(null, { status: 204 }), null],
    [new Response('', { status: 200 }), null],
    [Response.json({ saved: true }), { saved: true }],
  ]) {
    globalThis.fetch = async () => response;
    assert.deepEqual(await rpc(env, 'finish_email'), expected);
  }
});
test('RPC preserves database errors and fails closed on malformed JSON', async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async () =>
    Response.json({ code: '42501', message: 'Access denied' }, { status: 403 });
  await assert.rejects(() => rpc(env, 'private'), { status: 403, message: 'Access denied' });
  globalThis.fetch = async () => new Response('<html>upstream failed</html>', { status: 502 });
  await assert.rejects(() => rpc(env, 'private'), {
    status: 503,
    message: 'Ticketing service temporarily unavailable',
  });
});
test('terminal checkout orders offer explicit recovery while pending attempts resume', async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const input = {
    name: 'Buyer',
    email: 'buyer@example.test',
    qty: { startup: 1 },
    requestKey: crypto.randomUUID(),
  };
  for (const status of ['failed', 'expired', 'paid', 'refunded', 'needs_review', 'pending']) {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json({
        id: crypto.randomUUID(),
        status,
        checkout_url: 'https://checkout.stripe.test/existing',
      });
    };
    const response = await onRequest({
      request: new Request(env.SITE_URL + '/api/create-checkout', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
      env,
    });
    const result = await response.json();
    assert.equal(calls, 1);
    assert.equal(response.status, status === 'pending' ? 200 : 409);
    assert.equal(
      result.code,
      ['failed', 'expired'].includes(status)
        ? 'checkout_restart_required'
        : status === 'pending'
          ? undefined
          : 'checkout_already_completed',
    );
    if (status === 'pending') assert.equal(result.url, 'https://checkout.stripe.test/existing');
  }
});

test('aged unlinked checkout requests can restart without affecting linked pending sessions', async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const input = {
    name: 'Buyer',
    email: 'buyer@example.test',
    qty: { startup: 1 },
    requestKey: crypto.randomUUID(),
  };
  for (const linked of [false, true]) {
    globalThis.fetch = async () =>
      Response.json({
        id: crypto.randomUUID(),
        status: 'pending',
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        ...(linked ? { checkout_url: 'https://checkout.stripe.test/existing' } : {}),
      });
    const response = await onRequest({
      request: new Request(env.SITE_URL + '/api/create-checkout', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
      env,
    });
    const data = await response.json();
    assert.equal(response.status, linked ? 200 : 409);
    assert.equal(data.code, linked ? undefined : 'checkout_restart_required');
  }
});
