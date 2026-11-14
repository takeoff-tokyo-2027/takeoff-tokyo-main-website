import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emailContent, drainOutbox } from '../workers/email-outbox.js';
import { renderEmail } from '../workers/email-template.js';
const site = 'https://event.example';
test('all ticket emails include HTML, a text fallback and a usable action', () => {
  for (const template of ['purchase', 'transfer', 'accepted', 'crew']) {
    const content = emailContent(
      { template, payload: { orderId: 'order-1', token: 'transfer-token' } },
      site,
    );
    assert.match(content.htmlContent, /^<!doctype html>/i);
    assert.match(content.htmlContent, /<html lang="en">/);
    assert.match(content.htmlContent, /<h1[^>]*>/);
    assert.match(content.htmlContent, /href="https:\/\/event\.example\//);
    assert.match(content.textContent, /https:\/\/event\.example\//);
    assert.equal((content.htmlContent.match(/Takeoff Tokyo/g) || []).length, 1);
    assert.match(
      content.htmlContent,
      /<img src="https:\/\/event\.example\/images\/takeoff-tokyo-logo\.png" alt="Takeoff Tokyo" width="242" height="80"/,
    );
  }
  const transfer = emailContent(
    { template: 'transfer', payload: { token: 'secret<&"token' } },
    site,
  );
  assert.match(transfer.textContent, /#transfer=secret%3C%26%22token/);
  assert.doesNotMatch(transfer.htmlContent, /[?&]order=|<script|secret<&/);
  assert.throws(() => emailContent({ template: 'crew', payload: {} }, 'javascript:alert(1)'));
});
test('email templates escape text and attributes and retain the six-digit OTP placeholder', () => {
  const html = renderEmail({
    title: '<script>alert(1)</script>',
    message: 'A & B',
    action: '"Open"',
    url: 'https://event.example/?a=1&b="x"',
  });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /A &amp; B/);
  assert.match(html, /&amp;b=&quot;x&quot;/);
  const otp = readFileSync(
    new URL('../supabase/templates/email-otp.html', import.meta.url),
    'utf8',
  );
  assert.match(otp, /\{\{ \.Token \}\}/);
  assert.doesNotMatch(otp, /ConfirmationURL|TokenHash/);
  assert.match(
    otp,
    /<img src="\{\{ \.SiteURL \}\}\/images\/takeoff-tokyo-logo\.png" alt="Takeoff Tokyo"/,
  );
});
for (const local of [true, false])
  test(`${local ? 'local inbox' : 'Brevo'} delivery includes HTML and plain text`, async (t) => {
    const original = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = original;
    });
    let sent = false,
      finished = false;
    globalThis.fetch = async (url, options) => {
      if (String(url).endsWith('/rpc/claim_emails'))
        return Response.json([
          {
            id: 'mail-1',
            template: 'crew',
            recipient: 'test@example.test',
            payload: {},
            lease_token: 'lease-1',
          },
        ]);
      if (String(url).endsWith('/rpc/finish_email')) {
        assert.equal(JSON.parse(options.body).p_error, null);
        finished = true;
        return new Response(null, { status: 204 });
      }
      const body = JSON.parse(options.body);
      assert.match(local ? body.HTML : body.htmlContent, /<h1/);
      assert.match(local ? body.Text : body.textContent, /https:\/\/event\.example/);
      sent = true;
      return Response.json({ id: 'accepted' });
    };
    await drainOutbox({
      APP_ENV: local ? 'local' : 'production',
      SUPABASE_URL: local ? 'http://127.0.0.1:54321' : 'https://example.supabase.co',
      SUPABASE_DB_SCHEMA: 'public',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service',
      SITE_URL: site,
      LOCAL_EMAIL_URL: 'http://127.0.0.1:54324',
      BREVO_API_KEY: 'test-brevo',
      BREVO_SENDER_EMAIL: 'sender@example.test',
    });
    assert.equal(sent, true);
    assert.equal(finished, true);
  });

test('accepted-transfer emails lead both parties to the account sign-in chooser', () => {
  const content = emailContent({ template: 'accepted', payload: { ticketId: 'ticket-1' } }, site);
  assert.match(content.htmlContent, /href="https:\/\/event\.example\/account"/);
  assert.match(content.textContent, /View account: https:\/\/event\.example\/account\n/);
  assert.doesNotMatch(content.htmlContent, /href="https:\/\/event\.example\/account\/tickets"/);
});

const staging = {
  APP_ENV: 'staging',
  SUPABASE_DB_SCHEMA: 'staging',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service',
  SITE_URL: site,
  BREVO_API_KEY: 'test-brevo',
  BREVO_SENDER_EMAIL: 'sender@example.test',
  STAGING_EMAIL_ALLOWLIST: ' Holder@Example.test ',
};

test('missing staging email settings identify the binding before claiming any jobs', async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async () => assert.fail('Misconfigured email delivery claimed jobs');
  for (const key of ['BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'STAGING_EMAIL_ALLOWLIST']) {
    await assert.rejects(() => drainOutbox({ ...staging, [key]: '' }), {
      message:
        key === 'STAGING_EMAIL_ALLOWLIST'
          ? 'Configure STAGING_EMAIL_ALLOWLIST before running staging emails'
          : `Missing ticket email runtime setting: ${key}`,
    });
  }
});

test('staging records safe Brevo diagnostics while preserving retries and recipient restrictions', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  t.after(() => {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  });
  for (const [recipient, response, expected] of [
    [
      'holder@example.test',
      Response.json(
        {
          code: 'unauthorized',
          message: 'Unrecognised IP address 192.0.2.1 for holder@example.test',
        },
        { status: 401 },
      ),
      'Brevo HTTP 401 (unauthorized): IP restriction',
    ],
    [
      'holder@example.test',
      Response.json({ code: 'unauthorized', message: 'Key not found' }, { status: 401 }),
      'Brevo HTTP 401 (unauthorized): invalid API key',
    ],
    [
      'holder@example.test',
      Response.json(
        { code: 'invalid_parameter', message: 'Sender holder@example.test is not verified' },
        { status: 400 },
      ),
      'Brevo HTTP 400 (invalid_parameter)',
    ],
    [
      'holder@example.test',
      new Response('<html>Private gateway error</html>', { status: 502 }),
      'Brevo HTTP 502',
    ],
    ['holder@example.test', Response.json({}, { status: 201 }), null],
    ['outsider@example.test', null, 'Recipient is not in staging allowlist'],
  ]) {
    const logs = [];
    console.error = (...args) => logs.push(args);
    let finished = false,
      sent = false;
    globalThis.fetch = async (url, options) => {
      if (String(url).endsWith('/rpc/claim_emails')) {
        assert.equal(options.headers['Content-Profile'], 'staging');
        return Response.json([
          { id: 'mail-1', lease_token: 'lease-1', template: 'crew', recipient, payload: {} },
        ]);
      }
      if (String(url).endsWith('/rpc/finish_email')) {
        assert.deepEqual(JSON.parse(options.body), {
          p_id: 'mail-1',
          p_lease: 'lease-1',
          p_error: expected,
        });
        finished = true;
        return new Response(null, { status: 204 });
      }
      assert.equal(String(url), 'https://api.brevo.com/v3/smtp/email');
      assert.ok(response, 'Non-allowlisted recipient reached Brevo');
      sent = true;
      return response;
    };
    await drainOutbox(staging);
    assert.equal(finished, true);
    assert.equal(sent, response !== null);
    assert.deepEqual(logs, expected ? [['Email delivery retry', 'mail-1', expected]] : []);
  }
});
