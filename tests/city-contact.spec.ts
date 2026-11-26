import { test, expect, type Page } from '@playwright/test';
import { bodySeparation, playerBody, sweepBody } from '../src/features/home/city-contact';
import { createRoamSpace } from '../src/features/home/city-roam-physics';
import * as THREE from 'three';
import { createCircuitContact } from '../src/features/home/city-circuit-contact';

test('capsules stop fast movement, respect rotation and let touching bodies separate', () => {
  const other = { ...playerBody(0, 0, Math.PI / 2, true), id: 'traffic-0' };
  const player = playerBody(0, 10, 0, true); player.vz = -20;
  const contact = sweepBody(player, 0, -30, [other]);
  expect(contact?.id).toBe('traffic-0'); expect(contact!.speed).toBeGreaterThan(19);
  expect(bodySeparation(player, other).gap).toBeGreaterThanOrEqual(-.003);
  expect(player.z).toBeGreaterThan(3);
  expect(sweepBody(player, 0, 3, [other])).toBeNull();
  const nose = playerBody(0, 3, 0, true);
  expect(bodySeparation(nose, other).gap).toBeLessThan(0);
  nose.heading = Math.PI / 2;
  expect(bodySeparation(nose, other).gap).toBeGreaterThan(0);
  const person = { ...playerBody(3, 0, 0, false), id: 'person-1' };
  const foot = playerBody(0, 0, 0, false); foot.vx = 7;
  expect(sweepBody(foot, 20, 0, [person])?.kind).toBe('person');
  expect(foot.x).toBeLessThan(2.3);
  const elevated = { ...person, y: 4 };
  expect(sweepBody(foot, 20, 0, [elevated])).toBeNull();
});

test('roam movement is solid against live vehicles and people, including reverse and turn checks', () => {
  const space = createRoamSpace([]);
  const npc = { ...playerBody(0, 0, 0, true), id: 'traffic-1' };
  space.setBodies([npc]);
  const position = { x: 0, z: 12 };
  expect(space.move(position, 0, -40, 0, true)).toBe(true);
  expect(position.z).toBeGreaterThan(4.7);
  expect(space.contact()?.kind).toBe('vehicle');
  expect(space.move(position, 0, 2, 0, true)).toBe(false);
  const before = position.z;
  npc.z -= 10;
  space.move(position, 0, -3, 0, true); expect(position.z).toBeLessThan(before);
  const person = { ...playerBody(2.6, 0, 0, false), id: 'person-0' };
  space.setBodies([person]);
  expect(space.carClear(0, 0, 0)).toBe(true);
  expect(space.carClear(0, 0, Math.PI / 2)).toBe(false);
});

test('circuit cars stop for a visitor on the track and resume without jumping past them', () => {
  const car = new THREE.Group();
  const path = (angle: number) => new THREE.Vector3(Math.cos(angle) * 10, .5, Math.sin(angle) * 10);
  const circuit = createCircuitContact([car], path), point = path(.45);
  const visitor = playerBody(point.x, point.z, 0, false, .5);
  for (let i = 0; i < 240; i++) {
    circuit.update(1 / 60, i / 60, [visitor]);
    expect(bodySeparation(circuit.bodies()[0], visitor).gap).toBeGreaterThanOrEqual(-.003);
  }
  expect(circuit.drainContacts().length).toBeGreaterThan(0);
  const stopped = circuit.distance(car);
  for (let i = 0; i < 120; i++) circuit.update(1 / 60, 4 + i / 60, []);
  expect(circuit.distance(car)).toBeGreaterThan(stopped + 1);
});

async function enter(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 950 });
  await page.addInitScript(() => { sessionStorage.setItem('statoz-city-force-3d', 'true'); sessionStorage.setItem('statoz-arrival-v3', 'true'); });
  await page.goto('/');
  await expect(page.locator('[data-scene-status]')).toHaveAttribute('data-scene-status', 'ready', { timeout: 90000 });
  await expect(page.locator('html')).toHaveAttribute('data-city-assets', 'loaded', { timeout: 30000 });
  await expect.poll(() => page.evaluate(() => (window as any).__cityDebug.scene.getObjectByName('statoz-city-life').userData.walkers[0].clip), { timeout: 30000 }).not.toBeNull();
  await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-arrival', 'settled', { timeout: 15000 });
  await page.keyboard.press('Shift');
  await page.locator('[data-journey-chapter=city]').evaluate(el => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY + 1, behavior: 'instant' }));
  await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-roam-active', 'true');
}

test('driving into traffic stops both vehicles, responds once, and allows reversing away', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await enter(page);
  await page.evaluate(() => {
    const scene = (window as any).__cityDebug.scene;
    const car = scene.getObjectByName('city-traffic').userData.cars[0];
    const x = scene.getObjectByName('free-roam-car').position.x;
    car.seg = { kind: 'line', p: [x, 62, x, 20], length: 42 };
    car.s = 0; car.speed = 0; car.shift = car.shiftTarget = 0; car.contactHold = 20; car.pending = null; car.committed = true;
  });
  await page.waitForTimeout(120);
  await page.locator('canvas').focus(); await page.keyboard.down('w');
  await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-roam-contact-kind', 'vehicle', { timeout: 30000 });
  const count = await page.locator('[data-city-scene]').getAttribute('data-roam-contacts');
  await page.waitForTimeout(500);
  await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-roam-contacts', count!);
  await page.keyboard.up('w');
  await expect(page.locator('[data-roam-contact]')).toContainText('Vehicle contact');
  await page.screenshot({ path: 'docs/qa/contact-vehicle.png' });
  const separation = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('[data-city-scene]')!;
    const [x, z] = host.dataset.roamPosition!.split(',').map(Number);
    const car = (window as any).__cityDebug.scene.getObjectByName('city-traffic').userData.cars[0];
    return { x, z, other: car.collider, contacts: Number(host.dataset.roamContacts) };
  });
  expect(bodySeparation(playerBody(separation.x, separation.z, 0, true), separation.other).gap).toBeGreaterThan(-.03);
  await page.keyboard.down('s');
  await expect.poll(async () => Number((await page.locator('[data-city-scene]').getAttribute('data-roam-position'))!.split(',')[1]), { timeout: 15000 }).toBeGreaterThan(separation.z + .5);
  await page.keyboard.up('s');
  const after = (await page.locator('[data-city-scene]').getAttribute('data-roam-position'))!.split(',').map(Number);
  expect(after[1]).toBeGreaterThan(separation.z + .5);
  await expect(page.locator('[data-roam-contact]')).toHaveCount(0, { timeout: 4000 });
  expect(errors).toEqual([]);
});

test('on-foot contact makes a pedestrian react, separate and resume their route', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await enter(page, 390); await page.keyboard.press('e');
  await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-roam-vehicle', 'avatar');
  await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('[data-city-scene]')!;
    const [x, z] = host.dataset.roamPosition!.split(',').map(Number);
    const person = (window as any).__cityDebug.scene.getObjectByName('statoz-city-life').userData.walkers[0];
    person.x = x; person.z = z - 1.3; person.mind.state = 'idle'; person.mind.timer = 1.8; person.mind.leader = null; person.mind.vx = person.mind.vz = 0;
  });
  await page.waitForTimeout(100); await page.locator('canvas').focus();
  await page.keyboard.down('Shift'); await page.keyboard.down('w');
  await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-roam-contact-kind', 'person', { timeout: 30000 });
  await page.keyboard.up('w'); await page.keyboard.up('Shift');
  await expect(page.locator('[data-roam-contact]')).toContainText('Excuse me');
  await expect.poll(() => page.evaluate(() => (window as any).__cityDebug.scene.getObjectByName('statoz-city-life').userData.walkers[0].clip)).toBe('interact-right');
  await page.screenshot({ path: 'docs/qa/contact-person.png' });
  await expect.poll(() => page.evaluate(() => (window as any).__cityDebug.scene.getObjectByName('statoz-city-life').userData.walkers[0].clip), { timeout: 30000 }).not.toBe('interact-right');
  expect(errors).toEqual([]);
});
