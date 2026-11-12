import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../workers/site.js';
import { branchEnvironment, cloudflareBranch } from '../scripts/cloudflare-build.mjs';

test('Worker serves frontend paths through its asset binding', async () => {
  for (const path of ['/', '/account/tickets', '/admin/discounts', '/assets/app.js', '/apiary', '/account?next=/api']) {
    const request = new Request(`https://site.example${path}`);
    const response = new Response('frontend');
    assert.equal(await worker.fetch(request, { ASSETS: { fetch: received => {
      assert.equal(received, request);
      return response;
    } } }), response);
  }
});

test('Worker keeps API navigation, authentication, and errors out of SPA fallback', async () => {
  const env = { SITE_URL: 'https://site.example', ASSETS: { fetch() { assert.fail('API reached static assets'); } } };
  for (const path of ['/api', '/api/', '/api/me', '/api/admin/tickets', '/api/unknown']) {
    const response = await worker.fetch(new Request(`https://site.example${path}`, {
      headers: { 'Sec-Fetch-Mode': 'navigate' },
    }), env);
    assert.equal(response.status, 401);
    assert.match(response.headers.get('Content-Type'), /application\/json/);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.ok((await response.json()).error);
  }
  const foreign = await worker.fetch(new Request('https://site.example/api/create-checkout', {
    method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{}',
  }), env);
  assert.equal(foreign.status, 403);
});

test('Worker passes staging bindings to the public catalog RPC', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://example.supabase.co/rest/v1/rpc/ticket_command');
    assert.equal(options.headers['Content-Profile'], 'staging');
    assert.equal(options.headers.apikey, 'test-service-key');
    assert.equal(JSON.parse(options.body).p_action, 'catalog');
    return Response.json({ salesOpen: false, tickets: [] });
  };
  const response = await worker.fetch(new Request('https://dev.example/api/ticket-types'), {
    APP_ENV: 'staging', SUPABASE_DB_SCHEMA: 'staging',
    SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).salesOpen, false);
});

test('Workers Builds derives the frontend environment from its CI branch', () => {
  assert.equal(branchEnvironment(cloudflareBranch({ WORKERS_CI_BRANCH: 'main' })), 'production');
  assert.equal(branchEnvironment(cloudflareBranch({ WORKERS_CI_BRANCH: 'dev' })), 'staging');
  assert.equal(branchEnvironment(cloudflareBranch({ CF_PAGES_BRANCH: 'dev' })), 'staging');
  assert.throws(() => cloudflareBranch({ WORKERS_CI_BRANCH: 'main', CF_PAGES_BRANCH: 'dev' }));
  assert.throws(() => branchEnvironment(cloudflareBranch({ WORKERS_CI_BRANCH: 'feature' })));
  assert.throws(() => branchEnvironment(cloudflareBranch({})));
});
