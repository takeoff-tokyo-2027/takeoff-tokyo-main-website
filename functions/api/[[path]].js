import { newTicketInput, editTicketInput, priceInput, applyTicketPrice } from '../lib/ticket-pricing.js';
import { requestSignIn } from '../lib/sign-in.js';
import { ensureBootstrapAdmin } from '../lib/admin-bootstrap.js';
import { environment, stripeSecret, matchesPayment, allowedOrigin } from '../lib/environment.js';
import Stripe from 'stripe';
import { EVENT, HttpError, required, json, rpc, authenticate, body, uuid, email, text, checkoutInput, attendeeInput, origin, sha256, signCredential, verifyCredential, discountCode, discountInput } from '../lib/core.js';

export async function onRequest({ request, env }) {
  try { return await route(request, env); }
  catch (error) {
    if (!(error instanceof HttpError)) console.error('Ticket API failure', error.name, error.message);
    return json({ error: error instanceof HttpError ? error.message : 'Unable to complete request. Please try again.', ...(error instanceof HttpError && error.code ? { code: error.code } : {}) }, error.status || 500);
  }
}
function stripeClient(env) { return new Stripe(stripeSecret({...env,STRIPE_SECRET_KEY:required(env,'STRIPE_SECRET_KEY')}), { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2 }); }
async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');
  const method = request.method;
  if(request.headers.has('X-Takeoff-Environment')&&request.headers.get('X-Takeoff-Environment')!==environment(env))throw new HttpError(409,'Frontend and API environments do not match');
  if (method === 'POST' && path === '/api/stripe-webhook') return webhook(request, env);
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) throw new HttpError(405, 'Method not allowed');
  if (method !== 'GET' && request.headers.get('Origin') && !allowedOrigin(env,request)) throw new HttpError(403, 'Origin not allowed');
  if (method === 'GET' && path === '/api/ticket-types') return json(await rpc(env, 'ticket_command', { p_action: 'catalog', p_user: null }));
  if (method === 'POST' && path === '/api/auth/request-code') return json(await requestSignIn(env, await body(request)));
  if (method === 'POST' && path === '/api/create-checkout') {
    const input = await body(request);
    const data = { ...checkoutInput(input), email: email(input.email) };
    const order = await rpc(env, 'ticket_command', { p_action: 'order:create', p_user: null, p_data: data });
    if (['failed', 'expired'].includes(order.status)) throw new HttpError(409, 'This payment attempt ended. Restart payment to try again.', 'checkout_restart_required');
    if (['paid', 'refunded', 'needs_review'].includes(order.status)) throw new HttpError(409, 'This purchase is already complete. View your purchases or choose Buy again to make another purchase.', 'checkout_already_completed');
    if (order.status !== 'pending') throw new HttpError(409, 'Unable to resume this checkout. Please try again.');
    if (order.checkout_url) return json({ orderId: order.id, url: order.checkout_url });
    // Keep a retrying request bound to the same Stripe session, including after a failed DB link.
    if (Date.now() - Date.parse(order.created_at) > 23 * 60 * 60 * 1000) throw new HttpError(409, 'This checkout attempt is too old to resume. Restart payment to try again.', 'checkout_restart_required');
    const stripe = stripeClient(env);
    let discounts;
    if (order.discount_amount > 0) {
      const prices = await Promise.all(order.items.map(i => stripe.prices.retrieve(i.stripe_price_id)));
      const products = [...new Set(prices.filter((_,index) => order.discount_ticket_type_ids.includes(order.items[index].ticket_type_id)).map(p => typeof p.product === 'string' ? p.product : p.product.id))];
      if (prices.some((p,index) => !order.discount_ticket_type_ids.includes(order.items[index].ticket_type_id) && products.includes(typeof p.product === 'string' ? p.product : p.product.id))) throw new HttpError(503, 'Ticket types must have distinct Stripe products before discounts can be applied');
      const coupon = await stripe.coupons.create({ id: `tt_${order.id}`, name: order.discount_code, duration: 'once', amount_off: order.discount_amount, currency: 'jpy', applies_to: { products }, max_redemptions: 1 }, { idempotencyKey: `coupon:${order.id}` });
      discounts = [{ coupon: coupon.id }];
    }
    const session = await stripe.checkout.sessions.create({
      ...(discounts ? { discounts } : {}),
      mode: 'payment', adaptive_pricing: { enabled: false }, integration_identifier: 'takeoff_tokyo_checkout_xmbfqjrw', customer_email: order.buyer_email,
      client_reference_id: order.id, metadata: { order_id: order.id, event_slug: EVENT, environment: environment(env) },
      line_items: order.items.map(i => ({ price: i.stripe_price_id, quantity: i.quantity })),
      success_url: `${origin(env)}/account/tickets?order=${order.id}`, cancel_url: `${origin(env)}/?checkout=canceled`,
    }, { idempotencyKey: `checkout:${order.id}` });
    await rpc(env, 'ticket_command', { p_action: 'order:link', p_user: null, p_data: { id: order.id, requestKey: data.requestKey, sessionId: session.id, url: session.url } });
    return json({ orderId: order.id, url: session.url });
  }
  if (method === 'POST' && path === '/api/discounts/quote') {
    const input = await body(request);
    const selection = checkoutInput({ ...input, name: 'Quote', requestKey: crypto.randomUUID() });
    return json(await rpc(env, 'ticket_command', { p_action: 'discount:quote', p_user: null, p_data: { qty: selection.qty, discountCode: discountCode(input.discountCode) } }));
  }
  const user = await authenticate(env, request);
  if (path === '/api/me' || path.startsWith('/api/admin/')) await ensureBootstrapAdmin(env, user);
  const command = (action, data = {}) => rpc(env, 'ticket_command', { p_action: action, p_user: user.id, p_data: data });
  if (method === 'GET' && path === '/api/me') return json(await command('me'));
  if (method === 'GET' && path === '/api/me/tickets') return json({ tickets: await command('tickets:list') });
  if (path === '/api/admin/discounts') {
    if (method === 'GET') return json({ discounts: await command('discount:list') });
    if (method === 'POST') return json(await command('discount:create', discountInput(await body(request))), 201);
  }
  let match;
  if ((match = path.match(/^\/api\/admin\/discounts\/([^/]+)(\/uses)?$/))) {
    const id = uuid(match[1]);
    if (method === 'GET' && match[2]) {
      const offset = Number(url.searchParams.get('offset') || 0);
      if (!Number.isSafeInteger(offset) || offset < 0) throw new HttpError(400, 'Invalid pagination offset');
      return json({ uses: await command('discount:uses', { id, offset }) });
    }
    if (!match[2] && method === 'PATCH') return json(await command('discount:update', { ...discountInput(await body(request)), id }));
    if (!match[2] && method === 'DELETE') return json(await command('discount:delete', { id }));
  }
  if (method === 'GET' && (match = path.match(/^\/api\/orders\/([^/]+)$/))) return json(await command('order:get', { id: uuid(match[1]) }));
  if ((match = path.match(/^\/api\/tickets\/([^/]+)\/(attendee|qr|transfers)$/))) {
    const id = uuid(match[1]);
    if (match[2] === 'attendee' && method === 'PATCH') return json(await command('attendee:save', { ...attendeeInput(await body(request)), id }));
    if (match[2] === 'qr' && method === 'GET') {
      const result = await command('qr', { id });
      return json({ credential: await signCredential(env, result.credentialId) });
    }
    if (match[2] === 'transfers' && method === 'POST') {
      const data = await body(request);
      const token = crypto.randomUUID() + crypto.randomUUID();
      return json(await command('transfer:create', { id, email: email(data.email), token, tokenHash: await sha256(token) }), 201);
    }
  }
  if (method === 'DELETE' && (match = path.match(/^\/api\/transfers\/([^/]+)$/))) return json(await command('transfer:cancel', { transferId: uuid(match[1]) }));
  if (method === 'POST' && (match = path.match(/^\/api\/transfers\/([^/]+)\/accept$/))) {
    if (!/^[\da-f-]{72}$/.test(match[1])) throw new HttpError(400, 'Invalid transfer invitation');
    return json(await command('transfer:accept', { tokenHash: await sha256(match[1]) }));
  }
  if (method === 'POST' && path === '/api/checkins') {
    const { credential } = await body(request);
    return json(await command('checkin', { tokenHash: await verifyCredential(env, credential) }));
  }
  if (method === 'GET' && path === '/api/admin/tickets') {
    const offset = Number(url.searchParams.get('offset') || 0);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new HttpError(400, 'Invalid pagination offset');
    const filter = Object.fromEntries(['type','status','payment','checkin','day'].map(k=>[k,url.searchParams.get(k)||'']));
    if (filter.checkin && (!['yes','no'].includes(filter.checkin)||!['2027-03-17','2027-03-18'].includes(filter.day))) throw new HttpError(400,'Select a valid event day');
    return json(await rpc(env,'admin_read',{p_user:user.id,p_kind:'list',p_data:{...filter,q:text(url.searchParams.get('q')||'',200),offset}}));
  }
  const catalogCommand=(action,data={})=>rpc(env,'ticket_catalog_admin',{p_user:user.id,p_action:action,p_data:data});
  if(path==='/api/admin/ticket-types'){
    if(method==='GET')return json(await catalogCommand('list'));
    if(method==='POST')return json(await catalogCommand('create',newTicketInput(await body(request))),201);
  }
  if(method==='PATCH'&&path==='/api/admin/ticket-sales'){
    const data=await body(request);if(typeof data.enabled!=='boolean')throw new HttpError(400,'Sales state required');
    return json(await catalogCommand('sales',{enabled:data.enabled}));
  }
  if((match=path.match(/^\/api\/admin\/ticket-types\/([^/]+)(?:\/(prices|restore))?$/))){
    const id=uuid(match[1]);
    if(!match[2]&&method==='PATCH')return json(await catalogCommand('update',{...editTicketInput(await body(request)),id}));
    if(!match[2]&&method==='DELETE')return json(await catalogCommand('delete',{id}));
    if(match[2]==='restore'&&method==='POST')return json(await catalogCommand('restore',{id}));
    if(match[2]==='prices'&&method==='POST'){
      const input=priceInput(await body(request));
      // Instantiate lazily, after the database has checked the administrator role.
      const lazy={products:{retrieve:(...a)=>stripeClient(env).products.retrieve(...a),create:(...a)=>stripeClient(env).products.create(...a),update:(...a)=>stripeClient(env).products.update(...a)},prices:{create:(...a)=>stripeClient(env).prices.create(...a)}};
      return json(await applyTicketPrice(lazy,catalogCommand,id,input,environment(env)));
    }
  }
  if(method==='GET'&&(match=path.match(/^\/api\/admin\/tickets\/([^/]+)$/))) return json(await rpc(env,'admin_read',{p_user:user.id,p_kind:'detail',p_data:{id:uuid(match[1])}}));
  if (method === 'POST' && path === '/api/admin/crew-tickets') {
    const data = await body(request);
    return json(await command('crew:create', { email: email(data.email), name: text(data.name, 200, true) }), 201);
  }
  if (method === 'POST' && (match = path.match(/^\/api\/admin\/tickets\/([^/]+)\/revoke$/))) return json(await command('ticket:revoke', { id: uuid(match[1]) }));
  throw new HttpError(404, 'Endpoint not found');
}

async function webhook(request, env) {
  const stripe = stripeClient(env);
  const raw = await request.text();
  let event;
  try { event = await stripe.webhooks.constructEventAsync(raw, request.headers.get('stripe-signature'), required(env, 'STRIPE_WEBHOOK_SECRET')); }
  catch { throw new HttpError(400, 'Invalid webhook signature'); }
  const handled = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired', 'charge.refunded'];
  if (!handled.includes(event.type)) return json({ received: true });
  if (event.type === 'charge.refunded') {
    const charge = event.data.object;
    // Shared Stripe accounts can contain purchases for unrelated sites.
    const sessions = await stripe.checkout.sessions.list({ payment_intent: charge.payment_intent, limit: 1 });
    if (!sessions.data[0] || !matchesPayment(env,sessions.data[0],event.livemode)) return json({ received: true });
    // Reconcile current state rather than older refund-event snapshots.
    const current = await stripe.charges.retrieve(charge.id);
    await rpc(env, 'process_stripe_event', { p_data: { eventId: event.id, type: event.type, paymentIntent: current.payment_intent, refunded: current.amount_refunded } });
  } else {
    const incoming = event.data.object;
    if (!matchesPayment(env,incoming,event.livemode)) return json({ received: true });
    const session = await stripe.checkout.sessions.retrieve(incoming.id, { expand: ['line_items'] });
    if (!matchesPayment(env,session,event.livemode)) return json({received:true});
    if (session.client_reference_id !== session.metadata.order_id) throw new HttpError(400, 'Order reference mismatch');
    await rpc(env, 'process_stripe_event', { p_data: {
      eventId: event.id, type: event.type, orderId: session.metadata.order_id, sessionId: session.id,
      paymentStatus: session.payment_status, amount: session.amount_total, currency: session.currency, paymentIntent: session.payment_intent,
    } });
  }
  return json({ received: true });
}
