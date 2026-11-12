import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createTestHarness, experimental_readRawConfig } from 'wrangler';

test('built website and API work together in the Workers runtime', { timeout: 60000 }, async t => {
  const { rawConfig } = experimental_readRawConfig({ config: resolve('wrangler.toml') });
  assert.deepEqual({ ...rawConfig.previews.vars }, { APP_ENV: 'staging', SUPABASE_DB_SCHEMA: 'staging' });
  const folder = mkdtempSync(join(tmpdir(), 'takeoff-worker-'));
  // Use the real routing configuration, with no workspace env files or hosted credentials.
  const server = createTestHarness({ root: folder, workers: [{ config: {
    ...rawConfig,
    main: resolve(rawConfig.main),
    assets: { ...rawConfig.assets, directory: resolve(rawConfig.assets.directory) },
    vars: { ...rawConfig.previews.vars, SITE_URL: 'http://localhost',
      SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_SERVICE_ROLE_KEY: 'test-only' },
  } }] });
  t.after(async () => { try { await server.close(); } finally { rmSync(folder, { recursive: true, force: true }); } });
  await server.listen();
  for (const path of ['/', '/account/tickets', '/account/orders/example', '/admin/discounts']) {
    const response = await server.fetch(path, { headers: { 'Sec-Fetch-Mode': 'navigate' } });
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('Content-Type'), /text\/html/);
    assert.match(await response.text(), /id="root"/);
  }
  for (const path of ['/api', '/api/', '/api/me', '/api/unknown']) {
    const response = await server.fetch(path, { headers: { 'Sec-Fetch-Mode': 'navigate' } });
    assert.equal(response.status, 401, path);
    assert.match(response.headers.get('Content-Type'), /application\/json/);
    assert.ok((await response.json()).error);
  }
  const mismatch = await server.fetch('/api/ticket-types', { headers: { 'X-Takeoff-Environment': 'production' } });
  assert.equal(mismatch.status, 409);
  const rejected = await server.fetch('/api/create-checkout', {
    method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{}',
  });
  assert.equal(rejected.status, 403);
  const html = readFileSync(resolve('dist/index.html'), 'utf8');
  const css = html.match(/href="([^"]+\.css)"/)[1];
  const stylesheet = await server.fetch(css);
  assert.equal(stylesheet.status, 200);
  assert.match(stylesheet.headers.get('Content-Type'), /text\/css/);
});
