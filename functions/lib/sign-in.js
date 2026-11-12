import { HttpError, email, required, rpc, sha256 } from './core.js';
import { isBootstrapAdmin } from './admin-bootstrap.js';

export async function requestSignIn(env, input) {
  const address = email(input.email);
  const purpose = input.purpose || 'tickets';
  if (!['tickets', 'orders', 'transfer', 'admin'].includes(purpose)) throw new HttpError(400, 'Invalid sign-in request');
  let tokenHash = null;
  if (purpose === 'transfer') {
    if (typeof input.transferToken !== 'string' || !/^[\da-f-]{72}$/.test(input.transferToken)) throw new HttpError(400, 'Open a valid ticket transfer invitation to sign in');
    tokenHash = await sha256(input.transferToken);
  }
  const eligible = (purpose === 'admin' && isBootstrapAdmin(env, address)) ||
    await rpc(env, 'request_sign_in', { p_email: address, p_purpose: purpose, p_token_hash: tokenHash });
  if (eligible !== true) throw new HttpError(403, purpose === 'tickets' ? 'No tickets are associated with this email. Check your purchase or ticket email address.' : purpose === 'orders' ? 'No purchases are associated with this email.' : purpose === 'transfer' ? 'This invitation is unavailable or belongs to a different email.' : 'This email does not have staff access.');

  // Only request a code after database or bootstrap-list eligibility. Never
  // return privileged credentials or an authenticated session from this route.
  const key = required(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${required(env, 'SUPABASE_URL')}/auth/v1/otp`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: address, create_user: true }),
  });
  if (!response.ok) throw new HttpError(response.status === 429 ? 429 : 503, response.status === 429 ? 'Please wait before requesting another sign-in code.' : 'Unable to send a sign-in code. Please try again later.');
  return { sent: true };
}
