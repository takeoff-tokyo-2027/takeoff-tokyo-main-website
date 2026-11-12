import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/[[path]].js';
import { isBootstrapAdmin } from '../functions/lib/admin-bootstrap.js';

const env = { APP_ENV: 'production', SUPABASE_DB_SCHEMA: 'public', SITE_URL: 'https://site.example',
  SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  ADMIN_BOOTSTRAP_EMAILS: 'first@example.com, ankhasgreens@gmail.com' };
const user = { id: crypto.randomUUID(), email: 'ankhasgreens@gmail.com', email_confirmed_at: new Date().toISOString() };
const eventId = crypto.randomUUID();
const signIn = (email, purpose = 'admin') => new Request(`${env.SITE_URL}/api/auth/request-code`, {
  method: 'POST', headers: { Origin: env.SITE_URL }, body: JSON.stringify({ email, purpose }),
});
const account = () => new Request(`${env.SITE_URL}/api/me`, { headers: { Authorization: 'Bearer test-access-token' } });
function mockFetch(t, handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  t.after(() => { globalThis.fetch = original; });
}

test('bootstrap list matches complete email addresses, ignoring case and whitespace', () => {
  assert.equal(isBootstrapAdmin(env, ' ANKHASGREENS@GMAIL.COM '), true);
  for (const address of ['other@gmail.com', 'ankhasgreens@gmail.com.evil', 'prefixankhasgreens@gmail.com', '']) {
    assert.equal(isBootstrapAdmin(env, address), false);
  }
  assert.equal(isBootstrapAdmin({}, user.email), false);
});

test('a listed first admin can request an OTP without creating a role or requiring an existing user', async t => {
  let calls = 0;
  mockFetch(t, async (url, options) => {
    calls++;
    assert.equal(String(url), `${env.SUPABASE_URL}/auth/v1/otp`);
    assert.deepEqual(JSON.parse(options.body), { email: user.email, create_user: true });
    return Response.json({});
  });
  const response = await onRequest({ request: signIn(' ANKHASGREENS@GMAIL.COM '), env });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sent: true });
  assert.equal(calls, 1);
});

test('the bootstrap list does not bypass ordinary ticket/order eligibility or grant unlisted staff access', async t => {
  let calls = 0;
  mockFetch(t, async url => {
    calls++;
    assert.equal(String(url), `${env.SUPABASE_URL}/rest/v1/rpc/request_sign_in`);
    return Response.json(false);
  });
  for (const purpose of ['tickets', 'orders']) {
    assert.equal((await onRequest({ request: signIn(user.email, purpose), env })).status, 403);
  }
  assert.equal((await onRequest({ request: signIn('outsider@example.com'), env })).status, 403);
  assert.equal(calls, 3);
});

test('only the Supabase-verified account becomes an admin before account capabilities are loaded', async t => {
  const calls = [];
  mockFetch(t, async (url, options) => {
    const path = new URL(url).pathname;
    calls.push(path);
    if (path === '/auth/v1/user') return Response.json(user);
    if (path === '/rest/v1/events') {
      assert.equal(options.headers['Accept-Profile'], 'public');
      return Response.json([{ id: eventId }]);
    }
    if (path === '/rest/v1/event_staff') {
      assert.equal(new URL(url).searchParams.get('on_conflict'), 'event_id,user_id');
      assert.match(options.headers.Prefer, /resolution=merge-duplicates/);
      assert.equal(options.headers['Content-Profile'], 'public');
      assert.deepEqual(JSON.parse(options.body), { event_id: eventId, user_id: user.id, role: 'admin' });
      return new Response(null, { status: 204 });
    }
    assert.equal(path, '/rest/v1/rpc/ticket_command');
    assert.deepEqual(JSON.parse(options.body), { p_action: 'me', p_user: user.id, p_data: {} });
    return Response.json({ email: user.email, staffRole: 'admin', orders: [] });
  });
  const response = await onRequest({ request: account(), env });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).staffRole, 'admin');
  assert.deepEqual(calls, ['/auth/v1/user', '/rest/v1/events', '/rest/v1/event_staff', '/rest/v1/rpc/ticket_command']);
});

test('anonymous, forged, and unverified sessions cannot bootstrap admin access', async t => {
  let calls = 0;
  let authResponse = () => Response.json({ ...user, email_confirmed_at: null });
  mockFetch(t, async url => {
    calls++;
    assert.equal(new URL(url).pathname, '/auth/v1/user');
    return authResponse();
  });
  assert.equal((await onRequest({ request: new Request(`${env.SITE_URL}/api/me`), env })).status, 401);
  assert.equal(calls, 0);
  assert.equal((await onRequest({ request: account(), env })).status, 401);
  authResponse = () => Response.json({ error: 'Invalid JWT' }, { status: 401 });
  assert.equal((await onRequest({ request: account(), env })).status, 401);
  assert.equal(calls, 2);
});

test('client-controlled metadata cannot turn an unlisted account into an admin', async t => {
  let calls = 0;
  mockFetch(t, async url => {
    calls++;
    if (new URL(url).pathname === '/auth/v1/user') return Response.json({ ...user, email: 'outsider@example.com',
      user_metadata: { email: user.email, role: 'admin' } });
    assert.equal(new URL(url).pathname, '/rest/v1/rpc/ticket_command');
    return Response.json({ code: '42501', message: 'No account access' }, { status: 403 });
  });
  assert.equal((await onRequest({ request: account(), env })).status, 403);
  assert.equal(calls, 2);
});

test('bootstrap role writes use the selected environment schema and fail closed', async t => {
  const staging = { ...env, APP_ENV: 'staging', SUPABASE_DB_SCHEMA: 'staging' };
  let roleWrites = 0;
  mockFetch(t, async (url, options) => {
    const path = new URL(url).pathname;
    if (path === '/auth/v1/user') return Response.json(user);
    if (path === '/rest/v1/events') {
      assert.equal(options.headers['Accept-Profile'], 'staging');
      return Response.json([{ id: eventId }]);
    }
    assert.equal(path, '/rest/v1/event_staff');
    assert.equal(options.headers['Content-Profile'], 'staging');
    roleWrites++;
    return Response.json({ error: 'write failed' }, { status: 403 });
  });
  const response = await onRequest({ request: account(), env: staging });
  assert.equal(response.status, 503);
  assert.equal(roleWrites, 1);
  assert.doesNotMatch(await response.text(), /test-service-key/);
});
