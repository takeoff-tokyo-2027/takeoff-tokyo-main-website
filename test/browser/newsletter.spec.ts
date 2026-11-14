import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://www.youtube.com/**', (route) => route.fulfill({ body: '' }));
  await page.route('https://example.supabase.co/**', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/ticket-types', (route) =>
    route.fulfill({
      json: { salesEnabled: false, types: [], currencies: [], sectors: [] },
    }),
  );
  // Keep browser checks independent of Substack availability and real subscriptions.
  await page.route('https://takeofftokyo.substack.com/embed', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>Substack signup form</p>' }),
  );
});

test('home loads the Substack signup form below Tickets and before the footer', async ({
  page,
}) => {
  await page.goto('/');
  const newsletter = page.getByRole('region', { name: 'Newsletter', exact: true });
  await expect(newsletter).toBeVisible();
  await expect(page.locator('#tickets ~ #newsletter')).toBeVisible();
  await expect(page.locator('main > section:last-child')).toHaveAttribute('id', 'newsletter');
  await expect(page.locator('main + footer')).toBeVisible();

  const embed = newsletter.getByTitle('Subscribe to Takeoff Tokyo on Substack', { exact: true });
  await expect(embed).toHaveAttribute('src', 'https://takeofftokyo.substack.com/embed');
  await embed.scrollIntoViewIfNeeded();
  await expect(embed.contentFrame().getByText('Substack signup form')).toBeVisible();
  await expect(page).toHaveURL('/');
});

test('newsletter is limited to the home page', async ({ page }) => {
  for (const path of ['/account/tickets', '/privacy-policy']) {
    await page.goto(path);
    await expect(page.getByRole('contentinfo')).toBeVisible();
    await expect(page.locator('#newsletter')).toHaveCount(0);
    await expect(page.locator('iframe[src="https://takeofftokyo.substack.com/embed"]')).toHaveCount(
      0,
    );
  }
});
