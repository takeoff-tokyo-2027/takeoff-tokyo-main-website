import { onRequest } from '../functions/api/[[path]].js';

export default {
  fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return onRequest({ request, env });
    }
    return env.ASSETS.fetch(request);
  },
};
