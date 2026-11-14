import { expect, test } from '@playwright/test';

const legalPages = [
  { path: '/terms-conditions', title: 'Terms & Conditions' },
  { path: '/privacy-policy', title: 'Privacy Policy' },
  { path: '/scta', title: 'Commercial Disclosure' },
];

test.beforeEach(async ({ page }) => {
  await page.route('https://www.youtube.com/**', route => route.fulfill({ body: '' }));
});

test('home keeps the About section between the hero and shared footer', async ({ page }) => {
  await page.goto('/');
  const about = page.getByRole('region', { name: 'About', exact: true });
  await expect(about).toBeVisible();
  await expect(about.locator('iframe')).toHaveAttribute('src', 'https://www.youtube.com/embed/cdzSZpwCk-s');
  await expect(page.locator('.hero-content + #about')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toHaveCount(1);

  for (const { path, title } of legalPages) {
    await page.getByRole('navigation', { name: 'Legal', exact: true }).getByRole('link', { name: title, exact: true }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeFocused();
    await expect(page.getByRole('region', { name: 'About', exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Back to Takeoff Tokyo' }).click();
    await expect(about).toBeVisible();
  }
});

for (const { path, title } of [
  ...legalPages,
  { path: '/terms-and-conditions/', title: 'Terms & Conditions' },
  { path: '/commercial-disclosure/', title: 'Commercial Disclosure' },
]) {
  test(`public legal page survives a direct visit and refresh: ${path}`, async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', request => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
    });
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(`${title} | Takeoff Tokyo 2027`);
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
    expect(apiRequests).toEqual([]);
  });
}
