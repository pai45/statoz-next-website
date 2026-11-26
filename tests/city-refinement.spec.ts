import { createHash } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';

test('all refinement assets are local, intact and have source provenance', async ({ request }) => {
  const response = await request.get('/assets/city/refinement/manifest.json');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.assets).toHaveLength(5);
  for (const asset of manifest.assets) {
    expect(asset.license).toBeTruthy();
    expect(asset.sourceFile || asset.source).toBeTruthy();
    const response = await request.get(asset.output), bytes = await response.body();
    expect(response.ok(), asset.id).toBe(true);
    expect(bytes.length, asset.id).toBe(asset.bytes);
    expect(createHash('sha256').update(bytes).digest('hex'), asset.id).toBe(asset.outputSha256);
  }
});

// Read actual world state so this checks animation and its pause behavior, rather than a UI label.
const snapshot = (page: Page) => page.evaluate(() => {
  const debug = (window as any).__cityDebug, scene = debug.scene;
  const tram = scene.getObjectByName('city-night-tram'), drone = scene.getObjectByName('city-courier-drone');
  const fountain = scene.getObjectByName('park-fountain').children[0];
  const fan = scene.getObjectByName('rooftop-condenser-fan');
  const wind = scene.getObjectByName('city-broadleaf-trees').material;
  return { tram: tram.position.x, drone: drone.position.toArray(), fan: fan.rotation.y, water: Array.from(fountain.geometry.attributes.position.array.slice(0, 6)), actor: scene.getObjectByName('city-people').userData.probe, trees: !!wind, canvasCount: document.querySelectorAll('canvas').length };
});

for (const width of [1440, 390]) test(`city dynamics and game characters pause together at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 950 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => { sessionStorage.setItem('statoz-city-force-3d', 'true'); sessionStorage.setItem('statoz-arrival-v3', 'true'); });
  await page.goto('/#city/basketball');
  await expect(page.locator('[data-scene-status]')).toHaveAttribute('data-scene-status', 'ready', { timeout: 90000 });
  await expect(page.locator('html')).toHaveAttribute('data-city-refinement', 'loaded');
  await expect(page.locator('html')).toHaveAttribute('data-city-layout', 'clear');
  const initial = await snapshot(page);
  await expect.poll(async () => (await snapshot(page)).tram).not.toBe(initial.tram);
  await expect.poll(async () => (await snapshot(page)).actor).not.toBe(initial.actor);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Pause city activity/ }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('[data-quality]')).toHaveAttribute('data-activity-paused', 'true');
  await page.waitForTimeout(150);
  const paused = await snapshot(page); await page.waitForTimeout(350);
  expect(await snapshot(page)).toEqual(paused);
  expect(paused.canvasCount).toBe(1); expect(paused.trees).toBe(true);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Resume city activity/ }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).tram).not.toBe(paused.tram);
  expect(errors).toEqual([]);
});
