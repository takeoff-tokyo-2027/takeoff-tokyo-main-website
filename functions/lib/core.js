import { databaseSchema } from './environment.js';
export const EVENT = 'takeoff-tokyo-2027';
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function required(env, key) {
  if (!env[key]) throw new HttpError(503, 'Ticketing service is not configured');
  return env[key];
}
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export async function rpc(env, name, args = {}) {
  const res = await fetch(`${required(env, 'SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: required(env, 'SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Content-Profile': databaseSchema(env),
    },
    body: JSON.stringify(args),
  });
  const raw = await res.text();
  let data = null;
  try {
    if (raw.trim()) data = JSON.parse(raw);
  } catch {
    throw new HttpError(503, 'Ticketing service temporarily unavailable');
  }
  if (!res.ok) {
    const code = data?.code;
    const status =
      code === '42501'
        ? 403
        : code === '28000'
          ? 401
          : code === 'P0002'
            ? 404
            : code === 'P0001' || code === '23505'
              ? 409
              : code?.startsWith('22') || code?.startsWith('23')
                ? 400
                : 503;
    if (status === 503) console.error('Database operation failed', name, code);
    throw new HttpError(
      status,
      status === 503
        ? 'Ticketing service temporarily unavailable'
        : status === 400
          ? 'Invalid ticket data'
          : data.message,
    );
  }
  return data;
}
export async function authenticate(env, request) {
  databaseSchema(env);
  const token = request.headers.get('Authorization');
  if (!token?.startsWith('Bearer ')) throw new HttpError(401, 'Please sign in');
  const res = await fetch(`${required(env, 'SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: required(env, 'SUPABASE_SERVICE_ROLE_KEY'), Authorization: token },
  });
  if (!res.ok) throw new HttpError(401, 'Your sign-in expired. Please sign in again.');
  const user = await res.json();
  if (!user.id || !user.email_confirmed_at)
    throw new HttpError(401, 'Verify your email before continuing');
  return user;
}
export async function body(request) {
  if (Number(request.headers.get('Content-Length') || 0) > 20000)
    throw new HttpError(413, 'Request too large');
  const raw = await request.text();
  if (raw.length > 20000) throw new HttpError(413, 'Request too large');
  try {
    const data = JSON.parse(raw);
    if (!data || Array.isArray(data) || typeof data !== 'object') throw 0;
    return data;
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}
export function uuid(value) {
  if (
    typeof value !== 'string' ||
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)
  )
    throw new HttpError(400, 'Invalid identifier');
  return value.toLowerCase();
}
export function email(value) {
  if (
    typeof value !== 'string' ||
    value.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  )
    throw new HttpError(400, 'Valid recipient email required');
  return value.trim().toLowerCase();
}
export function text(value, max = 200, mandatory = false) {
  if (value == null && !mandatory) return null;
  if (typeof value !== 'string' || value.length > max || (mandatory && !value.trim()))
    throw new HttpError(400, 'Invalid or missing text field');
  return value.trim();
}
export function checkoutInput(data) {
  const qty = data.qty;
  if (
    !qty ||
    typeof qty !== 'object' ||
    Array.isArray(qty) ||
    Object.keys(qty).length > 100 ||
    Object.keys(qty).some((k) => !/^[a-z][a-z0-9_]{0,39}$/.test(k) || k === 'crew')
  )
    throw new HttpError(400, 'Invalid ticket selection');
  const values = Object.values(qty);
  if (
    values.some((v) => !Number.isInteger(v) || v < 0 || v > 100) ||
    values.reduce((a, b) => a + b, 0) < 1 ||
    values.reduce((a, b) => a + b, 0) > 100
  )
    throw new HttpError(400, 'Select 1–100 tickets');
  return {
    qty: { ...qty },
    name: text(data.name, 200, true),
    requestKey: uuid(data.requestKey),
    ...(data.discountCode ? { discountCode: discountCode(data.discountCode) } : {}),
  };
}
export function attendeeInput(data) {
  const p = data.profile || {};
  if (typeof p !== 'object' || Array.isArray(p)) throw new HttpError(400, 'Invalid questionnaire');
  const out = {};
  for (const key of ['business_description', 'target_vc_types', 'other_sector'])
    if (key in p) out[key] = text(p[key], 4000);
  for (const key of ['funding_amount', 'investment_min', 'investment_max'])
    if (key in p) {
      if (p[key] !== null && (!Number.isSafeInteger(p[key]) || p[key] < 0))
        throw new HttpError(400, 'Amounts must be nonnegative integer minor units');
      out[key] = p[key];
    }
  for (const key of ['funding_currency', 'investment_currency'])
    if (key in p) {
      if (p[key] !== null && !['JPY', 'USD', 'EUR', 'GBP'].includes(p[key]))
        throw new HttpError(400, 'Unsupported currency');
      out[key] = p[key];
    }
  if ('funding_stage' in p) {
    if (
      p.funding_stage !== null &&
      !['', 'pre_seed', 'seed', 'series_a', 'series_b', 'series_c_plus', 'other'].includes(
        p.funding_stage,
      )
    )
      throw new HttpError(400, 'Invalid funding stage');
    out.funding_stage = p.funding_stage;
  }
  for (const key of ['leads_deals', 'invests_internationally', 'seeking_lps'])
    if (key in p) {
      if (p[key] !== null && typeof p[key] !== 'boolean')
        throw new HttpError(400, 'Expected yes, no, or unanswered');
      out[key] = p[key];
    }
  if ('sectors' in p) {
    if (
      !Array.isArray(p.sectors) ||
      p.sectors.length > 9 ||
      p.sectors.some((s) => typeof s !== 'string' || s.length > 40)
    )
      throw new HttpError(400, 'Invalid sectors');
    out.sectors = [...new Set(p.sectors)];
  }
  return {
    name: text(data.name, 200, true),
    company: text(data.company),
    role: text(data.role),
    profile: out,
  };
}
export function origin(env) {
  return new URL(required(env, 'SITE_URL')).origin;
}
export async function sha256(value) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
async function qrKey(env) {
  const secret = required(env, 'QR_SIGNING_SECRET');
  if (secret.length < 32)
    throw new HttpError(503, 'QR signing secret must contain at least 32 characters');
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}
export async function signCredential(env, id) {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await qrKey(env),
    new TextEncoder().encode(id),
  );
  return `tt1.${id}.${Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
}
export async function verifyCredential(env, value) {
  if (typeof value !== 'string' || !/^tt1\.[\da-f-]{36}\.[\da-f]{64}$/.test(value))
    throw new HttpError(400, 'Invalid QR code');
  const [, id, signature] = value.split('.');
  uuid(id);
  const valid = await crypto.subtle.verify(
    'HMAC',
    await qrKey(env),
    Uint8Array.from(signature.match(/../g).map((s) => parseInt(s, 16))),
    new TextEncoder().encode(id),
  );
  if (!valid) throw new HttpError(400, 'Invalid QR signature');
  return sha256(id);
}

export function discountCode(value) {
  const code = text(value, 40, true).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(code))
    throw new HttpError(400, 'Use letters, numbers, hyphens or underscores for the discount code');
  return code;
}
export function discountInput(data) {
  const percentage = Number(data.percentage);
  if (
    !/^\d{1,3}(?:\.\d{1,2})?$/.test(String(data.percentage)) ||
    !(percentage > 0 && percentage <= 100)
  )
    throw new HttpError(
      400,
      'Percentage must be between 0.01 and 100, with at most two decimal places',
    );
  if (
    !Array.isArray(data.tickets) ||
    !data.tickets.length ||
    data.tickets.some(
      (t) => typeof t !== 'string' || !/^[a-z][a-z0-9_]{0,39}$/.test(t) || t === 'crew',
    )
  )
    throw new HttpError(400, 'Select specific public ticket types');
  if (data.active !== undefined && typeof data.active !== 'boolean')
    throw new HttpError(400, 'Active must be true or false');
  return {
    code: discountCode(data.code),
    percentage,
    tickets: [...new Set(data.tickets)],
    active: data.active ?? true,
  };
}
