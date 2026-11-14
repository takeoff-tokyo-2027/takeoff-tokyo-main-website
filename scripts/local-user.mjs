import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { databaseSchema } from '../functions/lib/environment.js';
try {
  const env = parseEnv(readFileSync('.env.local-testing.local', 'utf8'));
  if (env.APP_ENV !== 'local') throw new Error('Local environment required');
  databaseSchema(env);
  const email = (process.argv[2] || 'admin@example.test').toLowerCase();
  const role = process.argv[3] || 'admin';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['admin', 'checkin', 'holder'].includes(role))
    throw new Error('Usage: npm run local:user -- email [admin|checkin|holder]');
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  const users = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers,
  }).then((r) => r.json());
  let user = users.users?.find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, email_confirm: true }),
    });
    if (!r.ok) throw new Error('Could not create local account');
    user = await r.json();
  }
  if (role !== 'holder') {
    const events = await fetch(
      `${env.SUPABASE_URL}/rest/v1/events?slug=eq.takeoff-tokyo-2027&select=id`,
      { headers },
    ).then((r) => r.json());
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/event_staff`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ event_id: events[0].id, user_id: user.id, role }),
    });
    if (!r.ok) throw new Error('Could not assign local staff role');
  }
  console.log(
    `Local account ready: ${email} (${role}). Sign in with an OTP from http://127.0.0.1:54324.`,
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
