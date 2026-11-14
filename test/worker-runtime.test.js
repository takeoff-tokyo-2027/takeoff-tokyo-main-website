import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createTestHarness, experimental_readRawConfig } from 'wrangler';

test(
  'built website, API and scheduled email delivery work in the Workers runtime',
  { timeout: 60000 },
  async (t) => {
    const { rawConfig } = experimental_readRawConfig({ config: resolve('wrangler.toml') });
    assert.deepEqual(
      { ...rawConfig.previews.vars },
      {
        APP_ENV: 'staging',
        SUPABASE_DB_SCHEMA: 'staging',
        SITE_URL: 'https://dev-takeoff-tokyo-main-website.ankhasgreens.workers.dev',
      },
    );
    assert.deepEqual(rawConfig.triggers.crons, ['* * * * *']);
    assert.equal(rawConfig.previews.observability.enabled, true);
    assert.equal(rawConfig.previews.observability.logs.persist, true);
    let delivered = null,
      finished = false;
    const mailbox = createServer(async (request, response) => {
      let raw = '';
      for await (const part of request) raw += part;
      response.setHeader('Content-Type', 'application/json');
      if (request.url === '/rest/v1/rpc/claim_emails') {
        response.end(
          JSON.stringify(
            finished
              ? []
              : [
                  {
                    id: 'email-1',
                    lease_token: 'lease-1',
                    template: 'purchase',
                    recipient: 'buyer@example.test',
                    payload: { orderId: 'order-1' },
                  },
                ],
          ),
        );
      } else if (request.url === '/api/v1/send') {
        delivered = JSON.parse(raw);
        response.end('{}');
      } else if (request.url === '/rest/v1/rpc/finish_email') {
        finished = JSON.parse(raw).p_error === null;
        response.statusCode = 204;
        response.end();
      } else {
        response.statusCode = 404;
        response.end('{}');
      }
    });
    mailbox.listen(0, '127.0.0.1');
    await once(mailbox, 'listening');
    t.after(() => new Promise((resolve) => mailbox.close(resolve)));
    const fixtureUrl = `http://127.0.0.1:${mailbox.address().port}`;
    const folder = mkdtempSync(join(tmpdir(), 'takeoff-worker-'));
    // Use the real routing configuration, with no workspace env files or hosted credentials.
    const server = createTestHarness({
      root: folder,
      workers: [
        {
          config: {
            ...rawConfig,
            main: resolve(rawConfig.main),
            assets: { ...rawConfig.assets, directory: resolve(rawConfig.assets.directory) },
            vars: {
              APP_ENV: 'local',
              SUPABASE_DB_SCHEMA: 'public',
              SITE_URL: 'http://localhost',
              SUPABASE_URL: fixtureUrl,
              LOCAL_EMAIL_URL: fixtureUrl,
              SUPABASE_SERVICE_ROLE_KEY: 'test-only',
            },
          },
        },
      ],
    });
    t.after(async () => {
      try {
        await server.close();
      } finally {
        rmSync(folder, { recursive: true, force: true });
      }
    });
    await server.listen();
    for (const path of [
      '/',
      '/account/tickets',
      '/account/orders/example',
      '/admin/discounts',
      '/terms-conditions',
      '/privacy-policy',
      '/scta',
      '/terms-and-conditions/',
      '/commercial-disclosure/',
    ]) {
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
    const mismatch = await server.fetch('/api/ticket-types', {
      headers: { 'X-Takeoff-Environment': 'production' },
    });
    assert.equal(mismatch.status, 409);
    const rejected = await server.fetch('/api/create-checkout', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
      body: '{}',
    });
    assert.equal(rejected.status, 403);
    const html = readFileSync(resolve('dist/index.html'), 'utf8');
    const css = html.match(/href="([^"]+\.css)"/)[1];
    const stylesheet = await server.fetch(css);
    assert.equal(stylesheet.status, 200);
    assert.match(stylesheet.headers.get('Content-Type'), /text\/css/);
    const scheduled = await server
      .getWorker()
      .scheduled({ cron: '* * * * *', scheduledTime: new Date() });
    assert.equal(scheduled.outcome, 'ok');
    assert.equal(finished, true);
    assert.equal(delivered.Subject, 'Your tickets are ready');
    assert.match(delivered.HTML, /account\/tickets\?order=order-1/);
  },
);
