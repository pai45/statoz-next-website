import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
const output = 'public/assets/journey/scenes';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
try {
  for (const [suffix, width, height] of [['', 1440, 950], ['-mobile', 750, 1624]]) {
    // Render the mobile camera at CSS phone width, with a 2x capture.
    const context = await browser.newContext({ viewport: { width: suffix ? 375 : width, height: suffix ? 812 : height }, deviceScaleFactor: suffix ? 2 : 1 });
    await context.addInitScript(() => { sessionStorage.setItem('statoz-city-force-3d', 'true'); sessionStorage.setItem('statoz-arrival-v3', 'true'); });
    const page = await context.newPage();
    await page.goto(process.env.CITY_TEST_URL || 'http://127.0.0.1:4410/');
    await page.waitForFunction(() => document.documentElement.dataset.cityAssets === 'loaded' && document.querySelector('[data-scene-status]')?.dataset.sceneStatus === 'ready', null, { timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('[data-city-scene]')?.getAttribute('data-arrival') === 'settled', null, { timeout: 30000 });
    // Scripted jumps must not be eased by the inertial scroller, and the eased camera needs time to settle.
    await page.keyboard.press('Shift');
    await page.addStyleTag({ content: '.ignore-capture{display:none} [data-chapter-copy],[data-chapter-poster],header,[data-city-controls],[data-city-dock],[data-city-label],[data-city-link],[data-city-atmosphere],[data-drive-status],[data-arrival-loader],[class*="ring"],nav[aria-label="Opening journey"]{visibility:hidden!important}' });
    for (const id of ['welcome', 'entry', 'follow', 'predict', 'knowledge', 'games', 'city']) {
      await page.locator(`[data-journey-chapter="${id}"]`).evaluate(el => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY, behavior: 'instant' }));
      await page.waitForTimeout(3200);
      await sharp(await page.screenshot()).resize(width, height).webp({ quality: 83 }).toFile(`${output}/${id}${suffix}.webp`);
      console.log(`Captured ${id}${suffix}`);
    }
    await context.close();
  }
  // Simple view, loading and social cards should show the same refined city as WebGL.
  await sharp(`${output}/city.webp`).resize(1600, 1000, { fit: 'cover' }).webp({ quality: 84 }).toFile('public/assets/city/city-poster.webp');
  await sharp(`${output}/city-mobile.webp`).resize(750, 1900, { fit: 'cover' }).webp({ quality: 84 }).toFile('public/assets/city/city-mobile.webp');
  await sharp(`${output}/city.webp`).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 88 }).toFile('public/assets/city/city-social.jpg');
  await writeFile(`${output}/manifest.json`, JSON.stringify({ source: 'Local captures of the actual StatOz Three.js city with city refinement', script: 'scripts/capture-journey.mjs', logo: 'Unmodified StatOz Sports app_logo.png on the modelled bezel and pitch floor of the loader logo, gate emblem and app phone', originalGeometry: 'StatOz coupe, cockpit, mission beacons, particle lettering, gateway and city details', chapters: ['welcome', 'entry', 'follow', 'predict', 'knowledge', 'games', 'city'] }, null, 2));
} finally { await browser.close(); }
