import { test, expect } from '@playwright/test';

test('Pages serves every route, manifest, metadata and published identity', async ({ page, request, baseURL }) => {
  for (const route of ['', 'about/', 'blog/', 'blog/how-statoz-prediction-quiz-works/', 'blog/ipl-2026-prediction-journey/', 'download/', 'faq/', 'termsAndConditions/', 'privacyPolicy/', 'games/pitch-duel/', 'games/penalty-shootout/', 'games/football-chess/', 'predict/', 'sitemap.xml', 'robots.txt', 'manifest.webmanifest']) {
    const response = await request.get(new URL(route, baseURL).href);
    expect(response.status(), route).toBe(200);
  }
  const version = await (await request.get(new URL('version.json', baseURL).href)).json();
  expect(version.repository).toBe('pai45/statoz-next-website');
  if (process.env.EXPECTED_COMMIT) expect(version.commit).toBe(process.env.EXPECTED_COMMIT);
  const manifest = await (await request.get(new URL('manifest.webmanifest', baseURL).href)).json();
  expect(manifest.start_url).toBe(version.basePath + '/');
  for (const icon of manifest.icons) expect((await request.get(new URL(icon.src, baseURL).href)).status()).toBe(200);
  await page.goto('./about/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', version.siteUrl + '/about/');
  await page.getByRole('link', { name: 'StatOz home', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('StatOz Wizard.');
  await page.goto('./predict/');
  await expect(page).toHaveURL(new RegExp(version.basePath + '/#sports$'));
  await page.goto('./about/?layout=false');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary', exact: true })).toHaveCount(0);
});

for (const width of [1440, 390]) test(`Pages loads the complete city with working assets at ${width}`, async ({ page, baseURL }) => {
  await page.setViewportSize({ width, height: 950 });
  const errors: string[] = [], failed: string[] = [], escaped: string[] = [];
  const origin = new URL(baseURL!).origin, prefix = new URL(baseURL!).pathname;
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) failed.push(response.status() + ' ' + response.url()); });
  page.on('request', request => { const url = new URL(request.url()); if (['http:', 'https:'].includes(url.protocol) && url.origin === origin && !url.pathname.startsWith(prefix)) escaped.push(url.pathname); });
  await page.addInitScript(() => { sessionStorage.setItem('statoz-city-force-3d', 'true'); sessionStorage.setItem('statoz-arrival-v3', 'true'); });
  await page.goto('./#city/basketball');
  await expect(page.locator('[data-scene-status]')).toHaveAttribute('data-scene-status', 'ready', { timeout: 90000 });
  await expect(page.locator('html')).toHaveAttribute('data-city-assets', 'loaded', { timeout: 90000 });
  await expect(page.locator('html')).toHaveAttribute('data-city-refinement', 'loaded', { timeout: 90000 });
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `.cache/pages-${width}.png` });
  await expect(page.locator('[data-city-actions]').getByRole('link', { name: /Explore Sports/ })).toHaveAttribute('href', 'https://web.statoz.in/');
  await expect(page.locator('[data-city-actions]').getByRole('link', { name: /Play Games/ })).toHaveAttribute('href', 'https://games.statoz.in/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Pause city activity/ }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('[data-quality]')).toHaveAttribute('data-activity-paused', 'true');
  await page.goto('./#city/help');
  await page.locator('[data-city-actions]').getByRole('button', { name: /City guide/ }).click();
  await page.getByRole('navigation', { name: 'All city destinations' }).getByRole('link', { name: /^News/ }).click();
  await page.getByRole('link', { name: 'All stories', exact: true }).click();
  await expect(page).toHaveURL(new URL('blog/', baseURL!).href);
  expect(errors).toEqual([]); expect(failed).toEqual([]); expect(escaped).toEqual([]);
});
