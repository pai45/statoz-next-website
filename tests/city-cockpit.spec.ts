import { test, expect, type Page } from '@playwright/test';

async function jump(page: Page, id: string, fraction = 0) {
  await page.keyboard.press('Shift');
  await page.locator(`[data-journey-chapter="${id}"]`).evaluate((element, fraction) => window.scrollTo({ top: element.getBoundingClientRect().top + scrollY + element.clientHeight * fraction, behavior: 'instant' }), fraction);
}
const read = (page: Page, free = false) => page.evaluate(free => {
  const { scene, camera } = (window as any).__cityDebug;
  const car = scene.getObjectByName(free ? 'free-roam-car' : 'statoz-coupe');
  const cockpit = car.getObjectByName('statoz-cockpit'), screen = cockpit.getObjectByName('dashboard-map-screen');
  const image = screen.material.map.image as HTMLCanvasElement;
  const pixels = image.getContext('2d')!.getImageData(0, 70, image.width, image.height - 140).data;
  let digest = 0; for (let i = 0; i < pixels.length; i += 61) digest = (digest * 31 + pixels[i]) | 0;
  const position = screen.geometry.getAttribute('position'), points = [];
  screen.updateWorldMatrix(true, false);
  for (let i = 0; i < position.count; i++) {
    const point = screen.position.clone().set(position.getX(i), position.getY(i), position.getZ(i)); screen.localToWorld(point); point.project(camera);
    points.push({ x: (point.x + 1) * innerWidth / 2, y: (1 - point.y) * innerHeight / 2 });
  }
  return { x: car.position.x, z: car.position.z, heading: car.rotation.y, nav: cockpit.userData.navigation, digest, points };
}, free);

for (const width of [1440, 390]) test(`cockpit map travels with the car and fits the view at ${width}`, async ({ page }) => {
  const height = width < 700 ? 844 : 950;
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => { sessionStorage.setItem('statoz-city-force-3d', 'true'); sessionStorage.setItem('statoz-arrival-v3', 'true'); });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-arrival', 'settled', { timeout: 90000 });
  await jump(page, 'entry', .56);
  await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-camera-mode', 'cockpit');
  await expect.poll(async () => (await read(page)).nav.progress).toBeGreaterThan(.39);
  await page.waitForTimeout(800);
  const before = await read(page);
  expect(Math.abs(before.nav.z - before.z)).toBeLessThan(.8);
  for (const point of before.points) { expect(point.x).toBeGreaterThanOrEqual(0); expect(point.x).toBeLessThanOrEqual(width); expect(point.y).toBeGreaterThan(150); expect(point.y).toBeLessThan(height); }
  await jump(page, 'entry', .7);
  await expect.poll(async () => (await read(page)).nav.progress).toBeGreaterThan(.8);
  const after = await read(page);
  expect(after.nav.z).toBeLessThan(before.nav.z - 40);
  expect(after.nav.remaining).toBeLessThan(before.nav.remaining);
  expect(after.digest).not.toBe(before.digest);
  expect(Math.abs(after.nav.x - after.x)).toBeLessThan(.1);
  expect(Math.abs(after.nav.heading - after.heading)).toBeLessThan(.01);

  await jump(page, 'city');
  await expect(page.locator('[data-roam-hud]')).toBeVisible();
  await page.locator('canvas').focus(); await page.keyboard.press('c'); await page.keyboard.press('c');
  await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-roam-camera', 'cockpit');
  await expect(page.locator('[data-roam-map]')).toBeHidden();
  const visit = page.locator('[data-roam-waypoint]');
  await expect(visit).toBeVisible();
  await expect.poll(async () => { const pose = await read(page, true), box = await visit.boundingBox(); return Math.min(...pose.points.map(point => point.y)) - (box!.y + box!.height); }).toBeGreaterThan(6);
  await expect(page.locator('[data-roam-intro]')).toHaveCount(0);
  const parked = await read(page, true);
  await page.keyboard.down('w'); await page.waitForTimeout(800); await page.keyboard.up('w');
  await expect.poll(async () => (await read(page, true)).nav.z).toBeLessThan(parked.nav.z - 3);
  const moved = await read(page, true); expect(Math.abs(moved.nav.z - moved.z)).toBeLessThan(1.5);
  await page.keyboard.down('w'); await page.keyboard.down('a'); await page.waitForTimeout(450); await page.keyboard.up('a'); await page.keyboard.up('w');
  await expect.poll(async () => Math.abs((await read(page, true)).nav.heading)).toBeGreaterThan(.1);
  await expect.poll(async () => { const pose = await read(page, true); return Math.abs(pose.nav.heading - pose.heading); }).toBeLessThan(.01);
  await page.screenshot({ path: `docs/qa/cockpit/${width}-free-drive.jpg` });
  await page.keyboard.press('c'); await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-roam-camera', 'chase');
  await expect(page.locator('[data-roam-map]')).toBeVisible();
  await page.keyboard.press('c'); await page.keyboard.press('c');
  await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-roam-camera', 'cockpit');
  await page.keyboard.press('e'); await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-roam-vehicle', 'avatar');
  expect(await page.evaluate(() => {
    const car = (window as any).__cityDebug.scene.getObjectByName('free-roam-car');
    return { roof: car.getObjectByName('hero-roof').visible, surround: car.getObjectByName('hero-greenhouse').visible, liner: car.getObjectByName('cockpit-headliner').visible };
  })).toEqual({ roof: true, surround: true, liner: false });
  expect(errors).toEqual([]);
});
