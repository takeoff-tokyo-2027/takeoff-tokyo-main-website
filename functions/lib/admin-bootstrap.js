import { EVENT, HttpError, required } from './core.js';
import { databaseSchema } from './environment.js';

export function isBootstrapAdmin(env, address) {
  if (typeof env.ADMIN_BOOTSTRAP_EMAILS !== 'string' || typeof address !== 'string') return false;
  return env.ADMIN_BOOTSTRAP_EMAILS.split(',').map(value => value.trim().toLowerCase())
    .filter(Boolean).includes(address.trim().toLowerCase());
}

// The caller must obtain this user from Supabase Auth, never from request input.
export async function ensureBootstrapAdmin(env, user) {
  if (!user.email_confirmed_at || !isBootstrapAdmin(env, user.email)) return;
  const schema = databaseSchema(env);
  const url = required(env, 'SUPABASE_URL');
  const key = required(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const result = await fetch(`${url}/rest/v1/events?slug=eq.${EVENT}&select=id`, {
    headers: { ...headers, 'Accept-Profile': schema },
  });
  if (!result.ok) throw new HttpError(503, 'Unable to initialize admin access. Please try again.');
  const events = await result.json();
  if (!Array.isArray(events) || events.length !== 1 || !events[0].id) {
    throw new HttpError(503, 'The event must be configured before admin access can be initialized.');
  }
  const saved = await fetch(`${url}/rest/v1/event_staff?on_conflict=event_id,user_id`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'Content-Profile': schema,
      Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ event_id: events[0].id, user_id: user.id, role: 'admin' }),
  });
  if (!saved.ok) throw new HttpError(503, 'Unable to initialize admin access. Please try again.');
}
