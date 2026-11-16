import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRoamSpace, ROAM_BOUNDS } from '../src/features/home/city-roam-physics';

test('movement sweeps into walls, slides on foot and respects district limits', () => {
  const space = createRoamSpace([{ minX: 2, maxX: 3, minZ: -8, maxZ: 8, minY: 0, maxY: 10 }]);
  const foot = { x: 0, z: 0 };
  space.move(foot, 30, 4, 0, false);
  expect(foot.x).toBeLessThan(1.65); expect(foot.z).toBeCloseTo(4);
  const car = { x: 0, z: 0 }; expect(space.move(car, 30, 0, 0, true)).toBe(true); expect(car.x).toBeLessThan(1);
  const edge = { x: ROAM_BOUNDS.maxX - 1, z: 0 }; space.move(edge, 50, 0, 0, false); expect(edge.x).toBeLessThan(ROAM_BOUNDS.maxX);
  expect(space.cameraDistance({ x: 0, y: 2, z: 0 }, { x: 6, y: 3, z: 0 })).toBeLessThan(.4);
  // An overhead bridge has no invisible wall at street level.
  expect(createRoamSpace([{ minX: -2, maxX: 2, minZ: -2, maxZ: 2, minY: 8, maxY: 10 }]).clear(0, 0, .4)).toBe(true);
});

async function enter(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 950 });
  await page.addInitScript(() => { sessionStorage.setItem('statoz-city-force-3d', 'true'); sessionStorage.setItem('statoz-arrival-v3', 'true'); });
  await page.goto('/');
  await expect(page.locator('[data-scene-status]')).toHaveAttribute('data-scene-status', 'ready', { timeout: 90000 });
  await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-arrival', 'settled', { timeout: 15000 });
  await page.keyboard.press('Shift');
  await page.locator('[data-journey-chapter="city"]').evaluate(el => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY + 1, behavior: 'instant' }));
  await expect(page.locator('[data-roam-hud]')).toBeVisible();
  await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-roam-active', 'true');
}
const position = (page: Page) => page.locator('[data-city-scene]').getAttribute('data-roam-position');
async function settings(page: Page) { await page.getByRole('button', { name: 'Settings', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible(); }

test('journey hands over the car; avatar can leave, walk and re-enter it', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await enter(page);
  expect(Number(await page.locator('[data-city-scene]').getAttribute('data-roam-solids'))).toBeGreaterThan(100);
  const initial = await position(page);
  await page.keyboard.down('w'); await page.waitForTimeout(700);
  await page.mouse.move(850, 420); await page.mouse.down(); await page.mouse.move(910, 420, { steps: 5 }); await page.mouse.up();
  const looked = await position(page); await page.waitForTimeout(500); await expect.poll(() => position(page)).not.toBe(looked);
  await page.keyboard.up('w');
  await expect.poll(() => position(page)).not.toBe(initial);
  await page.keyboard.press('e');
  await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-roam-vehicle', 'avatar');
  await settings(page); await expect(page.getByRole('button', { name: /Enter car/ })).toBeEnabled();
  await page.getByRole('button', { name: /Enter car/ }).click();
  await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-roam-vehicle', 'car');
  await page.keyboard.press('e');
  const avatar = await position(page); await page.locator('canvas').focus();
  await page.keyboard.down('w'); await page.waitForTimeout(700); await page.keyboard.up('w');
  await expect.poll(() => position(page)).not.toBe(avatar);
  await page.screenshot({ path: 'docs/qa/roam-avatar.png' });
  await page.keyboard.press('r');
  await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-roam-position', '-19.80,70.00');
  await settings(page); await page.getByRole('button', { name: /Pause city activity/ }).click(); await page.getByRole('button', { name: 'Close', exact: true }).click();
  const paused = await position(page); await page.locator('canvas').focus(); await page.keyboard.down('w'); await page.waitForTimeout(300); await page.keyboard.up('w'); expect(await position(page)).toBe(paused);
  await settings(page); await page.getByRole('button', { name: /Resume city activity/ }).click(); await page.getByRole('button', { name: 'Close', exact: true }).click();
  // Changing focus must release held keys; movement must not continue after returning.
  await page.locator('canvas').focus(); await page.keyboard.down('w'); await page.waitForTimeout(100); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.keyboard.up('w');
  await page.waitForTimeout(150); const unfocused = await position(page); await page.waitForTimeout(200); expect(await position(page)).toBe(unfocused);
  await page.keyboard.press('Escape'); await expect(page.locator('[data-roam-hud]')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Sports grounds' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('touch controls work, release on cancellation and fit phone and landscape', async ({ page }) => {
  await enter(page, 390);
  await expect(page.getByRole('button', { name: 'Accelerate', exact: true })).toBeVisible();
  const initial = await position(page), button = page.getByRole('button', { name: 'Accelerate', exact: true });
  const buttonBox = await button.boundingBox();
  await page.mouse.move(buttonBox!.x + buttonBox!.width / 2, buttonBox!.y + buttonBox!.height / 2); await page.mouse.down();
  await page.waitForTimeout(900);
  await button.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await page.mouse.up();
  await expect.poll(() => position(page)).not.toBe(initial);
  const result = await new AxeBuilder({ page }).include('[data-roam-hud]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/qa/roam-phone.png' });
  await page.setViewportSize({ width: 812, height: 375 });
  for (const label of ['Accelerate', 'Reverse', 'Brake']) {
    const box = await page.getByRole('button', { name: label, exact: true }).boundingBox();
    expect(box).toBeTruthy(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(375);
  }
  await settings(page); await page.getByRole('button', { name: /City overview/ }).click();
  await expect(page.locator('[data-roam-hud]')).toHaveCount(0);
  await settings(page); await page.getByRole('button', { name: /Free roam/ }).click();
  await expect(page.locator('[data-roam-hud]')).toBeVisible();
});

test('desktop is clear, the hint expires, and settings own the controls', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const timeline: { visible: boolean; time: number }[] = []; (window as any).__roamHintTimeline = timeline;
    let previous = false;
    new MutationObserver(() => {
      const visible = !!document.querySelector('[data-roam-intro]');
      if (visible !== previous) { timeline.push({ visible, time: performance.now() }); previous = visible; }
    }).observe(document, { childList: true, subtree: true });
  });
  await enter(page);
  await expect(page.locator('[data-roam-touch-controls]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Return to city overview', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Replay journey' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Explore', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-roam-intro]')).toHaveCount(0, { timeout: 5000 });
  const timeline = await page.evaluate(() => (window as any).__roamHintTimeline as { visible: boolean; time: number }[]);
  expect(timeline.map(event => event.visible)).toEqual([true, false]);
  expect(timeline[1].time - timeline[0].time).toBeGreaterThanOrEqual(3900);
  expect(timeline[1].time - timeline[0].time).toBeLessThan(7000);
  const map = await page.locator('[data-roam-map]').boundingBox();
  expect(map!.width).toBeLessThanOrEqual(240); expect(map!.height).toBeLessThan(180);
  expect(map!.x + map!.width / 2).toBeCloseTo(720, 0); expect(map!.y).toBeGreaterThan(750);
  await expect(page.getByRole('img', { name: /3D topographical city map/ })).toBeVisible();
  await page.screenshot({ path: 'docs/qa/roam-clean-desktop.png' });
  await settings(page);
  const before = await position(page); await page.keyboard.down('w'); await page.waitForTimeout(220); await page.keyboard.up('w'); expect(await position(page)).toBe(before);
  const audit = await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  await page.screenshot({ path: 'docs/qa/city-settings.png' });
  await page.getByRole('button', { name: /On-screen movement controls/ }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click(); await expect(page.locator('[data-roam-touch-controls]')).toBeVisible();
  await settings(page); await page.getByRole('button', { name: /On-screen movement controls/ }).click();
  await page.getByRole('button', { name: /Step out of car/ }).click();
  await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-roam-vehicle', 'avatar');
  await expect(page.locator('[data-roam-touch-controls]')).toHaveCount(0);
  await expect(page.locator('[data-roam-intro]')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('free-roam place prompt opens a real destination and returns to the player', async ({ page }) => {
  await enter(page);
  await page.locator('canvas').focus(); await page.keyboard.down('w'); await page.waitForTimeout(3000); await page.keyboard.up('w');
  const visit = page.getByRole('button', { name: /Visit / });
  await expect(visit).toBeVisible();
  await visit.click();
  await expect(page.locator('[data-city-hud]')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('[data-roam-hud]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to the city', exact: true }).click();
  await expect(page.locator('[data-roam-hud]')).toBeVisible();
  await expect(page.locator('[data-city-hud]')).toHaveCSS('display', 'none');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'docs/qa/roam-desktop.png' });
});

for (const width of [1440, 390]) test(`visit marker follows the destination when looking around at ${width}`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await enter(page, width);
  const marker = page.locator('[data-roam-waypoint]');
  await expect(marker).toBeVisible();
  await expect(marker).toHaveAttribute('data-location', 'download');
  await expect.poll(() => marker.evaluate(element => getComputedStyle(element, '::before').backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await expect(marker).toHaveCSS('border-top-width', '0px');
  const initial = await marker.boundingBox();
  expect(initial!.width).toBeGreaterThanOrEqual(160); expect(initial!.height).toBeGreaterThanOrEqual(60);
  expect(initial!.x + initial!.width / 2).toBeLessThan(width / 2);
  // Turn the chase view around while the player stays still. The west-side destination
  // must move to the other side of the screen, rather than remaining above the map.
  for (let turn = 0; turn < (width < 700 ? 2 : 1); turn++) {
    const start = width < 700 ? 50 : 480, end = width < 700 ? 312 : 1004;
    await page.mouse.move(start, 300); await page.mouse.down(); await page.mouse.move(end, 300, { steps: 14 }); await page.mouse.up();
  }
  await expect.poll(async () => { const box = await marker.boundingBox(); return box!.x + box!.width / 2; }).toBeGreaterThan(width / 2);
  const moved = await marker.boundingBox(), map = await page.locator('[data-roam-map]').boundingBox();
  expect(moved!.x).toBeGreaterThanOrEqual(0); expect(moved!.x + moved!.width).toBeLessThanOrEqual(width);
  expect(moved!.y).toBeGreaterThan(100); expect(moved!.y + moved!.height).toBeLessThan(map!.y);
  await expect(page.locator('[data-roam-intro]')).toHaveCount(0, { timeout: 5000 });
  const audit = await new AxeBuilder({ page }).include('[data-roam-hud]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  await page.screenshot({ path: `docs/qa/city-waypoint-${width}.png` });
  await marker.click();
  await expect(page.locator('[data-city-hud] h2')).toHaveText('App Station');
  expect(errors).toEqual([]);
});
