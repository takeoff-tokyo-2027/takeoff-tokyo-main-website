import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import worker from '../workers/site.js';

const env = {
  APP_ENV: 'production',
  SUPABASE_DB_SCHEMA: 'public',
  SITE_URL: 'https://site.example',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service',
  STRIPE_SECRET_KEY: 'sk_live_fake',
  STRIPE_WEBHOOK_SECRET: 'whsec_fake',
  BREVO_API_KEY: 'test-brevo',
  BREVO_SENDER_EMAIL: 'tickets@example.test',
};
const orderId = crypto.randomUUID();
const session = {
  id: 'cs_live_example',
  client_reference_id: orderId,
  payment_status: 'paid',
  amount_total: 1000,
  currency: 'jpy',
  payment_intent: 'pi_example',
  metadata: { order_id: orderId, event_slug: 'takeoff-tokyo-2027', environment: 'production' },
};
function webhook() {
  const payload = JSON.stringify({
    id: 'evt_example',
    type: 'checkout.session.completed',
    livemode: true,
    data: { object: session },
  });
  const signature = new Stripe(env.STRIPE_SECRET_KEY).webhooks.generateTestHeaderString({
    payload,
    secret: env.STRIPE_WEBHOOK_SECRET,
  });
  return new Request(`${env.SITE_URL}/api/stripe-webhook`, {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: payload,
  });
}
const row = {
  id: 'email-1',
  lease_token: 'lease-1',
  template: 'purchase',
  recipient: 'buyer@example.test',
  payload: { orderId },
};
function mockFetch(t, handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  t.after(() => {
    globalThis.fetch = original;
  });
}
function context() {
  const tasks = [];
  return {
    tasks,
    waitUntil(task) {
      tasks.push(task);
    },
  };
}

test('verified payment commits before email delivery, and a slow email provider does not delay acknowledgement', async (t) => {
  const ctx = context();
  let fulfilled = false,
    acknowledgedEmail = false;
  let releaseEmail, startedEmail;
  const provider = new Promise((resolve) => {
    releaseEmail = resolve;
  });
  const started = new Promise((resolve) => {
    startedEmail = resolve;
  });
  mockFetch(t, async (url, options) => {
    const path = new URL(url).pathname;
    if (path === `/v1/checkout/sessions/${session.id}`) return Response.json(session);
    if (path.endsWith('/process_stripe_event')) {
      assert.equal(JSON.parse(options.body).p_data.orderId, orderId);
      fulfilled = true;
      return Response.json({ processed: true });
    }
    if (path.endsWith('/claim_emails')) {
      assert.equal(fulfilled, true);
      return Response.json([row]);
    }
    if (String(url) === 'https://api.brevo.com/v3/smtp/email') {
      const message = JSON.parse(options.body);
      assert.equal(message.subject, 'Your tickets are ready');
      assert.match(message.htmlContent, new RegExp(orderId));
      assert.equal(options.headers['api-key'], env.BREVO_API_KEY);
      startedEmail();
      await provider;
      return Response.json({ messageId: 'accepted' });
    }
    assert.match(path, /\/finish_email$/);
    assert.equal(JSON.parse(options.body).p_error, null);
    acknowledgedEmail = true;
    return new Response(null, { status: 204 });
  });
  const response = await worker.fetch(webhook(), env, ctx);
  assert.equal(response.status, 200);
  assert.equal(fulfilled, true);
  assert.equal(ctx.tasks.length, 1);
  await started;
  assert.equal(acknowledgedEmail, false);
  releaseEmail();
  await Promise.all(ctx.tasks);
  assert.equal(acknowledgedEmail, true);
});

test('invalid webhooks and failed fulfillment never start email delivery', async (t) => {
  const ctx = context();
  const invalid = webhook();
  invalid.headers.set('stripe-signature', 'invalid');
  assert.equal((await worker.fetch(invalid, env, ctx)).status, 400);
  mockFetch(t, async (url) => {
    if (new URL(url).pathname === `/v1/checkout/sessions/${session.id}`)
      return Response.json(session);
    assert.match(String(url), /\/process_stripe_event$/);
    return Response.json({ code: 'P0001', message: 'Order not found' }, { status: 409 });
  });
  assert.equal((await worker.fetch(webhook(), env, ctx)).status, 409);
  assert.equal(ctx.tasks.length, 0);
});

test('scheduled retry processes previously queued purchase emails without a new webhook', async (t) => {
  const ctx = context();
  let sent = false,
    finished = false;
  mockFetch(t, async (url, options) => {
    if (String(url).endsWith('/claim_emails')) return Response.json([row]);
    if (String(url).endsWith('/finish_email')) {
      assert.equal(JSON.parse(options.body).p_error, null);
      finished = true;
      return new Response(null, { status: 204 });
    }
    assert.equal(String(url), 'https://api.brevo.com/v3/smtp/email');
    sent = true;
    return Response.json({ messageId: 'accepted' });
  });
  worker.scheduled({}, env, ctx);
  await Promise.all(ctx.tasks);
  assert.equal(sent, true);
  assert.equal(finished, true);
});

test('provider failures preserve payment acknowledgement and record an outbox retry', async (t) => {
  const ctx = context();
  let retry = false;
  const originalError = console.error;
  console.error = () => {};
  t.after(() => {
    console.error = originalError;
  });
  mockFetch(t, async (url, options) => {
    const path = new URL(url).pathname;
    if (path === `/v1/checkout/sessions/${session.id}`) return Response.json(session);
    if (path.endsWith('/process_stripe_event')) return Response.json({ processed: true });
    if (path.endsWith('/claim_emails')) return Response.json([row]);
    if (String(url) === 'https://api.brevo.com/v3/smtp/email')
      return Response.json({}, { status: 503 });
    assert.match(path, /\/finish_email$/);
    assert.equal(JSON.parse(options.body).p_error, 'Brevo HTTP 503');
    retry = true;
    return new Response(null, { status: 204 });
  });
  assert.equal((await worker.fetch(webhook(), env, ctx)).status, 200);
  await Promise.all(ctx.tasks);
  assert.equal(retry, true);
});
