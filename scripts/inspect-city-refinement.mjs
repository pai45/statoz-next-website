import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = process.env.CITY_CAPTURE_DIR || 'docs/qa/refinement';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, deviceScaleFactor: 1 });
    await context.addInitScript(() => { sessionStorage.setItem('statoz-city-force-3d', 'true'); sessionStorage.setItem('statoz-arrival-v3', 'true'); });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 400)); });
    await page.goto(process.env.CITY_TEST_URL || 'http://127.0.0.1:4410/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.cityAssets === 'loaded' && document.querySelector('[data-scene-status]')?.dataset.sceneStatus === 'ready', null, { timeout: 90000 });
    await page.locator('[data-journey-chapter="city"]').evaluate(el => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY, behavior: 'instant' }));
    await page.waitForTimeout(6500);
    await page.screenshot({ path: `${output}/city-${width}.png` });
    const stats = await page.locator('[data-quality]').evaluate(el => ({ ...el.dataset }));
    results.push({ width, errors, stats, layout: await page.locator('html').getAttribute('data-city-layout'), enhancement: await page.locator('html').getAttribute('data-city-refinement') });
    if (width === 1440) {
      for (const sport of ['Basketball', 'Cricket', 'Football', 'Racing']) {
        await page.getByRole('navigation', { name: 'Sports grounds' }).getByRole('link', { name: new RegExp(sport) }).click();
        await page.waitForTimeout(2100);
        await page.screenshot({ path: `${output}/${sport.toLowerCase()}.png` });
        await page.keyboard.press('Escape');
      }
    }
    await context.close();
  }
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  if (results.some(result => result.errors.length || result.layout !== 'clear')) process.exitCode = 1;
} finally { await browser.close(); }
