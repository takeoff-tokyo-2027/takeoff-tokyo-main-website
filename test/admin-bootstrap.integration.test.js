import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { onRequest } from '../functions/api/[[path]].js';
import { databaseSchema, loopback } from '../functions/lib/environment.js';

test('a local verified first admin is persisted once across concurrent account requests', async t => {
  const env = parseEnv(readFileSync('.env.local-testing.local', 'utf8'));
  assert.equal(env.APP_ENV, 'local');
  assert.ok(loopback(env.SUPABASE_URL));
  assert.ok(loopback(env.SITE_URL));
  databaseSchema(env);
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const service = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
  const address = `bootstrap-${crypto.randomUUID()}@example.test`;
  env.ADMIN_BOOTSTRAP_EMAILS = address;
  const { data: event, error: eventError } = await service.from('events').select('id').eq('slug', 'takeoff-tokyo-2027').single();
  assert.equal(eventError, null);
  // Generate a local test OTP without sending an email or bypassing OTP verification.
  const { data: link, error: linkError } = await service.auth.admin.generateLink({ type: 'magiclink', email: address });
  assert.equal(linkError, null);
  const userId = link.user.id;
  t.after(async () => {
    const removed = await service.from('event_staff').delete().eq('event_id', event.id).eq('user_id', userId);
    assert.equal(removed.error, null);
    assert.equal((await service.auth.admin.deleteUser(userId)).error, null);
  });
  const before = await service.from('event_staff').select('user_id').eq('user_id', userId);
  assert.equal(before.error, null);
  assert.equal(before.data.length, 0);
  const anonymous = await onRequest({ request: new Request(`${env.SITE_URL}/api/me`), env });
  assert.equal(anonymous.status, 401);
  const auth = createClient(env.SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, options);
  const verified = await auth.auth.verifyOtp({ email: address, token: link.properties.email_otp, type: 'email' });
  assert.equal(verified.error, null);
  assert.ok(verified.data.user.email_confirmed_at);
  const responses = await Promise.all([1, 2].map(() => onRequest({
    request: new Request(`${env.SITE_URL}/api/me`, {
      headers: { Authorization: `Bearer ${verified.data.session.access_token}` },
    }), env,
  })));
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.equal((await response.json()).staffRole, 'admin');
  }
  const after = await service.from('event_staff').select('user_id,role').eq('event_id', event.id).eq('user_id', userId);
  assert.equal(after.error, null);
  assert.deepEqual(after.data, [{ user_id: userId, role: 'admin' }]);
});
