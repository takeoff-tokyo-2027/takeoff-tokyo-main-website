import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://www.youtube.com/**', (route) => route.fulfill({ body: '' }));
  await page.route('https://takeofftokyo.substack.com/embed', (route) =>
    route.fulfill({ body: '' }),
  );
  await page.route('https://example.supabase.co/**', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/ticket-types', (route) =>
    route.fulfill({
      json: {
        salesEnabled: true,
        types: [{ code: 'startup', label: 'Startup', amount: 4200, currency: 'JPY' }],
        currencies: [{ code: 'JPY', decimals: 0 }],
        sectors: [],
      },
    }),
  );
});

for (const width of [320, 640, 768, 1440]) {
  test(`public sections share heading and container conventions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.ticket-offer').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const styles = await page.evaluate(() => {
      const about = document.querySelector('#about')!;
      const tickets = document.querySelector('#tickets')!;
      const newsletter = document.querySelector('#newsletter')!;
      const who = document.querySelector('#who')!;
      const containers = [
        about.querySelector('.site-container')!,
        tickets.querySelector('.site-container')!,
        document.querySelector('.footer-inner')!,
      ];
      return {
        titles: [about, tickets, newsletter, who].map((section) => {
          const el = section.querySelector('h2')!;
          const style = getComputedStyle(el);
          return {
            fontSize: style.fontSize,
            fontFamily: style.fontFamily,
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight,
            letterSpacing: style.letterSpacing,
            textTransform: style.textTransform,
            textAlign: style.textAlign,
            marginBottom: style.marginBottom,
          };
        }),
        sectionPadding: [about, tickets, newsletter].map((el) => getComputedStyle(el).paddingTop),
        cards: ['.ticket-offer', '.newsletter-card'].map((selector) => {
          const style = getComputedStyle(document.querySelector(selector)!);
          return {
            background: style.backgroundColor,
            border: style.border,
            borderRadius: style.borderRadius,
            padding: style.padding,
          };
        }),
        edges: containers.map((el) => {
          const rect = el.getBoundingClientRect(),
            style = getComputedStyle(el);
          return [
            rect.left + parseFloat(style.paddingLeft),
            rect.right - parseFloat(style.paddingRight),
          ];
        }),
        columns: getComputedStyle(
          document.querySelector('.ticket-offers')!,
        ).gridTemplateColumns.split(' ').length,
        overflowing: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(styles.titles[0]).toEqual(styles.titles[1]);
    expect(styles.titles[0]).toEqual(styles.titles[2]);
    expect(styles.titles[0]).toEqual(styles.titles[3]);
    expect(styles.titles[0].fontSize).toBe('32px');
    expect(styles.cards[0]).toEqual(styles.cards[1]);
    expect(styles.sectionPadding[0]).toBe(styles.sectionPadding[1]);
    expect(styles.sectionPadding[0]).toBe(styles.sectionPadding[2]);
    expect(styles.edges[0]).toEqual(styles.edges[1]);
    expect(styles.edges[0]).toEqual(styles.edges[2]);
    expect(styles.columns).toBe(width < 640 ? 1 : 2);
    expect(styles.overflowing).toBe(false);
    const embed = await page.locator('.newsletter-embed').boundingBox();
    expect(embed).not.toBeNull();
    expect(embed!.x).toBeGreaterThanOrEqual(0);
    expect(embed!.x + embed!.width).toBeLessThanOrEqual(width);
    const textSizes = await page.evaluate(() => [
      ...new Set(
        [...document.querySelectorAll('body *')]
          .filter(
            (el) =>
              !['SCRIPT', 'STYLE'].includes(el.tagName) &&
              el.getClientRects().length > 0 &&
              [...el.childNodes].some(
                (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
              ),
          )
          .map((el) => getComputedStyle(el).fontSize),
      ),
    ]);
    expect(textSizes.sort()).toEqual(['16px', '32px']);
  });
}

for (const fontPercent of [100, 200]) {
  test(`body text and section titles scale at ${fontPercent}% text size`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/account/tickets');
    await page.addStyleTag({ content: `html { font-size: ${fontPercent}%; }` });
    await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveCSS(
      'font-size',
      `${(16 * fontPercent) / 100}px`,
    );

    await page.goto('/');
    await page.addStyleTag({ content: `html { font-size: ${fontPercent}%; }` });
    await expect(page.getByRole('heading', { name: 'About', exact: true })).toHaveCSS(
      'font-size',
      `${(32 * fontPercent) / 100}px`,
    );
    await expect(page.getByRole('heading', { name: 'Tickets', exact: true })).toHaveCSS(
      'font-size',
      `${(32 * fontPercent) / 100}px`,
    );
    await expect(page.getByRole('heading', { name: 'Newsletter', exact: true })).toHaveCSS(
      'font-size',
      `${(32 * fontPercent) / 100}px`,
    );
    await page.getByRole('button', { name: 'Get startup ticket', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Buy tickets' });
    await expect(modal.locator('.takeoff-modal-dialog__title')).toHaveCSS(
      'font-size',
      `${(16 * fontPercent) / 100}px`,
    );
    await expect(modal.locator('.checkout-step')).toHaveCSS(
      'font-size',
      `${(16 * fontPercent) / 100}px`,
    );
    await expect(modal.getByRole('spinbutton', { name: 'Startup quantity' })).toHaveCSS(
      'font-size',
      `${(16 * fontPercent) / 100}px`,
    );
    await page.evaluate(() => document.fonts.ready);
    const body = modal.locator('.takeoff-modal-dialog__body');
    const fitsBody = () => body.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    expect(await fitsBody()).toBe(true);
    const quantity = modal.getByRole('spinbutton', { name: 'Startup quantity' });
    await quantity.fill('100');
    expect(await quantity.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await fitsBody()).toBe(true);
    await modal.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(modal.getByLabel('Buyer’s email')).toBeVisible();
    await modal.locator('.checkout-discount > summary').click();
    expect(await fitsBody()).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const fitsDialog = await modal.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fitsDialog).toBe(true);
  });
}

for (const width of [280, 320, 640]) {
  test(`long ticket names stay inside their cards at ${width}px`, async ({ page }) => {
    const label = 'W'.repeat(120);
    await page.route('**/api/ticket-types', (route) =>
      route.fulfill({
        json: {
          salesEnabled: true,
          types: [{ code: 'general_admission', label, amount: 4200, currency: 'JPY' }],
          currencies: [{ code: 'JPY', decimals: 0 }],
          sectors: [],
        },
      }),
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const card = page.getByRole('article', { name: label, exact: true });
    await expect(card).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await card.getByRole('button').click();
    await expect(page.getByRole('dialog', { name: 'Buy tickets' })).toBeVisible();
  });
}

test('reduced motion stops hero playback and dialog transitions, including live changes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const video = page.locator('.hero-video');
  await expect(video).not.toHaveAttribute('autoplay');
  await expect(video).toHaveAttribute('poster', /hero-poster.*\.webp/);
  expect(await video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);

  await page.getByRole('button', { name: 'Get startup ticket', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Buy tickets' });
  await expect(modal).toHaveCSS('transition-duration', '0s');
  await expect(modal.locator('.ticket-modal')).toHaveCSS('transition-duration', '0s');
  await page.keyboard.press('Escape');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(video).toHaveAttribute('autoplay', '');
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
});

test('shared fonts load as external WOFF2 assets', async ({ page }) => {
  const fonts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font') fonts.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.every((url) => url.endsWith('.woff2'))).toBe(true);
  expect(
    await page.evaluate(() => [...document.fonts].every((font) => font.status === 'loaded')),
  ).toBe(true);
});
