import { test, expect, type Page } from '@playwright/test';

const catalog = {
  salesEnabled: true,
  types: [
    { code: 'startup', label: 'Startup', amount: 4200, currency: 'JPY' },
    { code: 'investor', label: 'Investor', amount: 8400, currency: 'JPY' },
  ],
  currencies: [{ code: 'JPY', decimals: 0 }],
  sectors: [],
};

async function setup(page: Page) {
  await page.route('https://www.youtube.com/**', route => route.fulfill({ body: 'Event video' }));
  await page.route('https://example.supabase.co/**', route => route.fulfill({ json: {} }));
  await page.route('**/api/ticket-types', route => route.fulfill({ json: catalog }));
}

for (const width of [280, 320, 1280]) test(`Register scrolls to ticket cards below About at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  await setup(page);
  await page.goto('/');
  const tickets = page.getByRole('region', { name: 'Tickets', exact: true });
  await expect(tickets.getByRole('article')).toHaveCount(2);
  await expect(tickets.getByRole('article', { name: 'Startup', exact: true })).toContainText('¥4,200');
  await expect(tickets.getByRole('article', { name: 'Investor', exact: true })).toContainText('¥8,400');
  expect(await page.locator('#about').evaluate(about => !!(about.compareDocumentPosition(document.getElementById('tickets')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await page.getByRole('link', { name: 'REGISTER' }).click();
  await expect(page).toHaveURL('/#tickets');
  await expect(tickets.getByRole('heading', { name: 'Tickets', exact: true })).toBeInViewport();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const [first, second] = await tickets.getByRole('article').evaluateAll(cards => cards.map(card => {
    const { top, bottom } = card.getBoundingClientRect();
    return { top, bottom };
  }));
  if (width < 640) expect(second.top).toBeGreaterThanOrEqual(first.bottom);
  else expect(second.top).toBe(first.top);
});

for (const type of ['startup', 'investor']) test(`${type} card opens selection, then buyer details and mixed checkout`, async ({ page }) => {
  await setup(page);
  let purchases = 0;
  await page.route('**/api/create-checkout', route => {
    const data = route.request().postDataJSON();
    expect(data).toMatchObject({ name: 'Guest buyer', email: 'guest@example.com', qty: { startup: 2, investor: 1 } });
    expect(data.requestKey).toMatch(/^[\da-f-]{36}$/);
    expect(route.request().headers().authorization).toBeUndefined();
    purchases++;
    return route.fulfill({ json: { url: 'https://checkout.stripe.test/mixed' } });
  });
  await page.route('https://checkout.stripe.test/**', route => route.fulfill({ body: 'Secure checkout' }));
  await page.goto('/');
  await page.getByRole('button', { name: `Get ${type} ticket`, exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Buy tickets' });
  await expect(modal.getByRole('heading', { name: '1. Select tickets' })).toBeFocused();
  await expect(modal.getByLabel('Buyer’s email')).toHaveCount(0);
  await expect(modal.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await modal.getByRole('spinbutton', { name: 'Startup quantity' }).fill('2');
  await modal.getByRole('button', { name: 'Increase Investor quantity' }).click();
  await expect(modal.locator('.checkout-footer strong')).toHaveText('¥16,800');
  await modal.getByRole('button', { name: 'Continue', exact: true }).click();
  expect(purchases).toBe(0);
  await expect(modal.getByRole('heading', { name: '2. Buyer details' })).toBeFocused();
  await expect(modal.getByRole('region', { name: 'Selected tickets' })).toContainText('Investor × 1');
  await modal.getByLabel('Buyer’s full name').fill('Guest buyer');
  await modal.getByLabel('Buyer’s email').fill('guest@example.com');
  await modal.getByRole('button', { name: 'Edit tickets' }).click();
  await expect(modal.getByRole('spinbutton', { name: 'Startup quantity' })).toHaveValue('2');
  await modal.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(modal.getByLabel('Buyer’s full name')).toHaveValue('Guest buyer');
  await expect(modal.getByLabel('Buyer’s email')).toHaveValue('guest@example.com');
  await modal.getByRole('button', { name: 'Continue to secure payment' }).click();
  await expect(page).toHaveURL('https://checkout.stripe.test/mixed');
  expect(purchases).toBe(1);
});

test('combined ticket quantities are limited to 100', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Get startup ticket', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('spinbutton', { name: 'Startup quantity' }).fill('100');
  await modal.getByRole('spinbutton', { name: 'Investor quantity' }).fill('1');
  await expect(modal.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await modal.getByRole('spinbutton', { name: 'Startup quantity' }).fill('99');
  await expect(modal.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
});

test('purchase modal traps focus and restores it after Escape, backdrop and Cancel', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Get investor ticket', exact: true });
  await trigger.click();
  const modal = page.getByRole('dialog');
  const close = modal.getByRole('button', { name: 'Close modal dialog', exact: true });
  await expect(modal.getByRole('heading', { name: '1. Select tickets' })).toBeFocused();
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.locator('.takeoff-modal-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('closed sales and paused ticket types cannot be purchased', async ({ page }) => {
  await setup(page);
  await page.route('**/api/ticket-types', route => route.fulfill({ json: { ...catalog, salesEnabled: false } }));
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Ticket sales are not open yet');
  await expect(page.getByRole('button', { name: 'Get startup ticket', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Get investor ticket', exact: true })).toBeDisabled();
  await page.route('**/api/ticket-types', route => route.fulfill({ json: { ...catalog, types: [catalog.types[0]] } }));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Get startup ticket', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Get investor ticket', exact: true })).toBeDisabled();
  await expect(page.getByRole('article', { name: 'Investor', exact: true })).toContainText('Currently unavailable');
});

test('catalog errors show a retry action and no fabricated prices', async ({ page }) => {
  await setup(page);
  let available = false;
  await page.route('**/api/ticket-types', route => !available
    ? route.fulfill({ status: 503, json: { error: 'Please try again later.' } })
    : route.fulfill({ json: catalog }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Unable to load ticket availability');
  await expect(page.getByRole('button', { name: 'Get startup ticket', exact: true })).toBeDisabled();
  await expect(page.locator('.ticket-offer__price').first()).toHaveText('Coming soon');
  available = true;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Get startup ticket', exact: true })).toBeEnabled();
  await expect(page.locator('.ticket-offer__price').first()).toHaveText('¥4,200');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
