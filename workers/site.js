import { onRequest } from '../functions/api/[[path]].js';
import { drainOutbox } from './email-outbox.js';

function queuesEmail(method, path) {
  return (
    method === 'POST' &&
    (path === '/api/stripe-webhook' ||
      path === '/api/admin/crew-tickets' ||
      /^\/api\/tickets\/[^/]+\/transfers$/.test(path) ||
      /^\/api\/transfers\/[^/]+\/accept$/.test(path))
  );
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      const response = await onRequest({ request, env });
      if (response.ok && queuesEmail(request.method, pathname.replace(/\/$/, ''))) {
        // Fulfillment has committed. Email delivery must not delay Stripe's acknowledgement.
        ctx.waitUntil(drainOutbox(env));
      }
      return response;
    }
    return env.ASSETS.fetch(request);
  },
  scheduled(_controller, env, ctx) {
    // Recover pending emails and retry provider failures without another payment event.
    ctx.waitUntil(drainOutbox(env));
  },
};
