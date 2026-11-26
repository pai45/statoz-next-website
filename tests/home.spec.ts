import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function chapter(page: Page, id: string) {
  await expect(page.locator('[data-enhanced]')).toHaveAttribute('data-enhanced', 'true');
  // Finish any inertial wheel motion before an independent programmatic chapter jump.
  await page.keyboard.press('Shift');
  await page.locator(`[data-journey-chapter="${id}"]`).evaluate(element => window.scrollTo({ top: element.getBoundingClientRect().top + scrollY, behavior: 'instant' }));
  await expect(page.locator(`[data-journey-chapter="${id}"]`)).toHaveAttribute('data-active', 'true');
  // These checks exercise the city directory/orbit UI. Free roam has its own handoff tests.
  if (id === 'city' && await page.locator('[data-roam-hud]').count()) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /City overview/ }).click();
    await expect(page.locator('[data-roam-hud]')).toHaveCount(0);
  }
}

/** The camera glides toward the scroll position; wait until it has come to rest. */
async function settledCamera(page: Page) {
  const scene = page.locator('[data-city-scene]');
  let last = '', same = 0;
  await expect.poll(async () => { const now = await scene.getAttribute('data-camera-position') || ''; same = now === last ? same + 1 : 0; last = now; return same; }, { intervals: [150], timeout: 20000 }).toBeGreaterThanOrEqual(3);
  return last;
}

async function ready3D(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('statoz-city-force-3d', 'true'));
  await page.goto('/');
  await expect(page.locator('[data-scene-status]')).toHaveAttribute('data-scene-status', 'ready', { timeout: 60000 });
  await expect(page.locator('html')).toHaveAttribute('data-city-assets', 'loaded', { timeout: 60000 });
}

for (const width of [375, 768, 1024, 1440]) {
  test(`journey layout and accessibility at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('StatOz Wizard.');
    await expect(page.getByRole('navigation', { name: 'Opening journey' }).getByRole('link')).toHaveCount(4);
    for (const id of ['welcome', 'entry', 'follow', 'predict', 'knowledge', 'games', 'city']) {
      await chapter(page, id);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), id).toBe(true);
      const audit = await new AxeBuilder({ page }).include(`[data-journey-chapter="${id}"]`).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(audit.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })), id).toEqual([]);
    }
    await chapter(page, 'welcome');
    await page.screenshot({ path: `docs/qa/journey-${width}.png` });
    expect(errors).toEqual([]);
  });
}

test('cinematic chapters reverse to the same camera positions', async ({ page }) => {
  await ready3D(page);
  const scene = page.locator('[data-city-scene]');
  await chapter(page, 'predict'); const predictionPose = await settledCamera(page);
  await chapter(page, 'knowledge'); expect(await settledCamera(page)).not.toBe(predictionPose);
  await chapter(page, 'games'); await chapter(page, 'predict');
  expect(await settledCamera(page)).toBe(predictionPose);
  await chapter(page, 'games'); expect(await settledCamera(page)).not.toBe(predictionPose);
  await expect(scene).toHaveAttribute('data-camera-chapter', 'games');
  await expect(page.getByRole('link', { name: 'Find my game' })).toBeVisible();
});

test('keyboard chapter links, rapid scroll and replay preserve navigation', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: 'Opening journey' });
  const knowledge = navigation.getByRole('link', { name: /Quiz/ });
  await knowledge.focus(); await page.keyboard.press('Enter');
  await expect(knowledge).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('#journey-knowledge')).toBeFocused();
  await chapter(page, 'city'); await chapter(page, 'predict'); await chapter(page, 'games');
  await expect(navigation.getByRole('link', { name: /Play/ })).toHaveAttribute('aria-current', 'step');
  await chapter(page, 'city');
  await page.getByRole('link', { name: 'StatOz City home' }).click();
  await expect(page.getByRole('link', { name: 'StatOz City home' })).toBeVisible();
  await expect(page.locator('#journey-welcome')).toBeFocused();
});

test('cinematic CTAs, authentic logo, transparent header and scene posters', async ({ page, request }) => {
  await page.goto('/');
  const header = page.locator('[data-city-header]');
  await expect(header.getByRole('navigation').getByRole('link')).toHaveCount(2);
  await expect(header.getByRole('button')).toHaveCount(1);
  await expect(header.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  await expect(header.locator('img')).toHaveAttribute('src', /app_logo/);
  for (const [id, label, href] of [['predict', 'Make a prediction', 'https://web.statoz.in/'], ['knowledge', 'Take a quiz', 'https://web.statoz.in/quiz/'], ['games', 'Find my game', 'https://games.statoz.in/']]) {
    await chapter(page, id); await expect(page.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href);
  }
  for (const id of ['welcome', 'entry', 'follow', 'predict', 'knowledge', 'games', 'city']) for (const suffix of ['', '-mobile']) expect((await request.get('/assets/journey/scenes/' + id + suffix + '.webp')).ok()).toBe(true);
  await chapter(page, 'city');
  expect(await header.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  await expect(page.getByRole('navigation', { name: 'Opening journey' })).toBeHidden();
});

test('one canvas supports Settings free roam and scrolling back from overview', async ({ page }) => {
  await ready3D(page); await expect(page.locator('canvas')).toHaveCount(1);
  const label = page.locator('[data-city-label="football"]');
  await chapter(page, 'city');
  await expect(label).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Free roam/ }).click();
  await expect(page.locator('[data-roam-hud]')).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /City overview/ }).click();
  const before = await page.evaluate(() => scrollY);
  await page.mouse.move(1100, 430); await page.mouse.wheel(0, -1000);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(before - 300);
  await expect(page.locator('[data-scene-status]')).toHaveAttribute('data-journey', 'true');
  await chapter(page, 'welcome'); await expect(page.locator('canvas')).toHaveCount(1);
});

test('grounds retain products and Escape restores focus', async ({ page }) => {
  await page.goto('/'); await chapter(page, 'city');
  for (const [sport, title] of [['Basketball', 'The Blacktop'], ['Cricket', 'The Oval'], ['Football', 'The Floodlights'], ['Racing', 'Neon Circuit']]) {
    const ground = page.getByRole('navigation', { name: 'Sports grounds' }).getByRole('link', { name: new RegExp(sport) });
    await ground.click(); await expect(page.locator('[data-city-hud] h2')).toHaveText(title);
    const actions = page.locator('[data-city-actions]');
    await expect(actions.getByRole('link', { name: /Explore Sports/ })).toHaveAttribute('href', 'https://web.statoz.in/');
    await expect(actions.getByRole('link', { name: /Play Games/ })).toHaveAttribute('href', 'https://games.statoz.in/');
    await page.keyboard.press('Escape'); await expect(ground).toBeFocused();
    await expect(page.locator('[data-city-hud]')).not.toHaveAttribute('data-open');
  }
});

test('city activity pauses and context loss offers recovery', async ({ page }) => {
  await ready3D(page); await chapter(page, 'city');
  const scene = page.locator('[data-quality]');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Pause city activity/ }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(scene).toHaveAttribute('data-activity-paused', 'true');
  await page.waitForTimeout(700); const paused = await scene.getAttribute('data-activity-time');
  await page.waitForTimeout(700); expect(await scene.getAttribute('data-activity-time')).toBe(paused);
  const supported = await page.locator('canvas').evaluate(canvas => {
    const extension = (canvas as HTMLCanvasElement).getContext('webgl2')?.getExtension('WEBGL_lose_context');
    extension?.loseContext(); return !!extension;
  });
  test.skip(!supported, 'Browser does not expose context-loss simulation.');
  await expect(page.locator('[data-simple]')).toHaveAttribute('data-simple', 'true');
  await expect(page.getByRole('button', { name: 'Retry 3D' })).toBeVisible();
  await chapter(page, 'predict');
  await expect(page.getByRole('link', { name: 'Make a prediction', exact: true })).toBeVisible();
});

test('guide and legacy deep links enter the city; Back leaves a venue', async ({ page }) => {
  await page.goto('/#city/help'); await page.locator('[data-city-actions]').getByRole('button', { name: /City guide/ }).click();
  const directory = page.getByRole('navigation', { name: 'All city destinations' });
  await expect(directory.getByRole('link')).toHaveCount(9);
  await directory.getByRole('link', { name: /Cricket/ }).click();
  await expect(page).toHaveURL(/#city\/cricket$/);
  await expect(page.locator('[data-scene-status]')).toHaveAttribute('data-journey', 'false');
  await expect(page.locator('[data-city-hud] h2')).toHaveText('The Oval');
  await page.goBack(); await expect(page.locator('[data-city-hud] h2')).toHaveText('Visitor Centre');
  await page.goto('/#predict'); await expect(page.locator('[data-city-hud] h2')).toHaveText('The Floodlights');
  await expect(page.locator('[data-scene-status]')).toHaveAttribute('data-journey', 'false');
});

test('reduced motion and failed WebGL keep the complete usable story', async ({ browser, baseURL }) => {
  for (const reduced of [true, false]) {
    const context = await browser.newContext({ reducedMotion: reduced ? 'reduce' : 'no-preference', viewport: { width: 375, height: 812 } });
    if (!reduced) await context.addInitScript(() => { HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext; });
    const page = await context.newPage(); await page.goto(baseURL!);
    await expect(page.locator('[data-simple]')).toHaveAttribute('data-simple', 'true');
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('[data-scene-status]')).toHaveAttribute('data-arrival', 'settled');
    await expect(page.getByRole('status', { name: 'Loading StatOz City' })).toHaveCount(0);
    await expect(page.locator('[data-journey-chapter]')).toHaveCount(7);
    await chapter(page, 'knowledge'); await expect(page.getByRole('link', { name: 'Take a quiz' })).toBeVisible();
    await chapter(page, 'city');
    await expect(page.locator('[data-simple-map]')).toBeVisible();
    await page.getByRole('navigation', { name: 'Sports grounds' }).getByRole('link', { name: /Basketball/ }).click();
    await expect(page.locator('[data-city-hud] h2')).toHaveText('The Blacktop');
    await page.keyboard.press('Escape');
    await page.goto(baseURL! + '/#city/help'); await page.locator('[data-city-actions]').getByRole('button', { name: /City guide/ }).click();
    await page.getByRole('navigation', { name: 'All city destinations' }).getByRole('link', { name: /Get the app/ }).click();
    await expect(page.locator('[data-city-actions]').getByRole('link', { name: /Google Play/ })).toBeVisible();
    await context.close();
  }
});

test('touch scrolls through the journey and back from the city', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage(); await page.goto(baseURL!);
  const input = await context.newCDPSession(page);
  async function swipe(startY: number, endY: number) {
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 210, y: startY }] });
    for (let i = 1; i <= 8; i++) await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 210, y: startY + (endY - startY) * i / 8 }] });
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await swipe(620, 270); await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await chapter(page, 'city'); const before = await page.evaluate(() => scrollY);
  await swipe(390, 720); await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(before - 100);
  await context.close();
});

test('landscape retains usable CTAs and grounds', async ({ page }) => {
  await page.setViewportSize({ width: 812, height: 375 }); await page.goto('/'); await chapter(page, 'knowledge');
  await expect(page.getByRole('link', { name: 'Take a quiz' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await chapter(page,'games');
  const play=page.getByRole('link',{name:'Find my game',exact:true});
  await expect(play).toBeVisible();
  const actionBox=await play.boundingBox(), navigationBox=await page.getByRole('navigation',{name:'Opening journey'}).boundingBox();
  expect(actionBox!.y+actionBox!.height).toBeLessThan(navigationBox!.y-8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await chapter(page, 'city');
  await page.getByRole('navigation', { name: 'Sports grounds' }).getByRole('link', { name: /Racing/ }).click();
  await expect(page.locator('[data-city-hud] h2')).toHaveText('Neon Circuit');
});

test('the drive reverses through the cockpit and the logo rests in the header', async ({ page }) => {
  await ready3D(page);
  const scene = page.locator('[data-city-scene]');
  await expect(scene).toHaveAttribute('data-logo-landed', 'true', { timeout: 30000 });
  await expect(page.locator('[data-city-header] > a img')).toBeVisible();
  async function drive(id: string, fraction: number) {
    await page.keyboard.press('Shift');
    await page.locator('[data-journey-chapter="' + id + '"]').evaluate((element, value) => window.scrollTo({ top: element.getBoundingClientRect().top + scrollY + element.clientHeight * value, behavior: 'instant' }), fraction);
    await expect(scene).toHaveAttribute('data-camera-chapter', id);
    return settledCamera(page);
  }
  await drive('entry', .6);
  await expect(scene).toHaveAttribute('data-camera-mode', 'cockpit');
  const car = await scene.getAttribute('data-car-position');
  await chapter(page, 'follow'); await settledCamera(page); await expect(scene).toHaveAttribute('data-camera-mode', 'exterior');
  await drive('entry', .6); await expect(scene).toHaveAttribute('data-car-position', car!);
  await chapter(page, 'welcome'); await expect(scene).toHaveAttribute('data-camera-mode', 'hero');
  await expect(page.getByRole('button', { name: /Pause motion|Resume motion/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Skip intro' })).toHaveCount(0);
});

test('arrival builds the logo while loading, lights the city once per session, and yields to input', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => sessionStorage.setItem('statoz-city-force-3d', 'true'));
  const page = await context.newPage(); await page.goto(baseURL!);
  const shell = page.locator('[data-scene-status]'), loader = page.getByRole('status', { name: 'Loading StatOz City' });
  await expect(loader).toBeVisible();
  await expect(shell).toHaveAttribute('data-arrival', 'reveal', { timeout: 90000 });
  await expect(page.locator('[data-city-scene]')).toHaveAttribute('data-logo-landed', 'true', { timeout: 15000 });
  await expect(shell).toHaveAttribute('data-arrival', 'settled', { timeout: 15000 });
  await expect(loader).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('StatOz Wizard.');
  expect(await page.evaluate(() => scrollY)).toBe(0);
  // A revisit in the same tab loads, then lands settled without replaying the reveal.
  await page.reload();
  await expect(shell).toHaveAttribute('data-scene-status', 'ready', { timeout: 90000 });
  await expect(shell).toHaveAttribute('data-arrival', 'settled', { timeout: 1500 });
  await context.close();
  // Any input during the reveal skips straight to the settled city.
  const second = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await second.addInitScript(() => sessionStorage.setItem('statoz-city-force-3d', 'true'));
  const fresh = await second.newPage(); await fresh.goto(baseURL!);
  const freshShell = fresh.locator('[data-scene-status]');
  await expect(freshShell).toHaveAttribute('data-arrival', 'reveal', { timeout: 90000 });
  await fresh.keyboard.press('Shift');
  await expect(freshShell).toHaveAttribute('data-arrival', 'settled', { timeout: 1500 });
  await second.close();
});

test('four themed chapter details retain real product destinations and respond to choices', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => sessionStorage.setItem('statoz-drive-missions-v1', JSON.stringify({ choice:{sport:'Football',game:'portfolio-formula'}, visited:['predict'] })));
  await page.goto('/');
  for (const [id,label,href] of [['follow','Start following','https://web.statoz.in/'],['predict','Make a prediction','https://web.statoz.in/'],['knowledge','Take a quiz','https://web.statoz.in/quiz/'],['games','Find my game','https://games.statoz.in/']]) {
    await chapter(page,id);
    const section=page.locator(`[data-journey-chapter="${id}"]`);
    await expect(section.getByRole('heading',{level:2})).toBeVisible();
    await expect(section.getByRole('heading',{level:2})).toHaveCSS('font-style','normal');
    await expect(section.getByRole('link',{name:label,exact:true})).toHaveAttribute('href',href);
    await expect(section.locator(`[data-chapter-detail="${id}"]`)).toBeVisible();
  }
  await chapter(page,'follow');
  const match=page.locator('[data-chapter-detail="follow"]');
  await expect(match).toContainText('213/5'); await expect(match).toContainText('211/5');
  await expect(match).toContainText('RCB won by 2 runs');
  await chapter(page,'predict');
  const forecast=page.locator('[data-chapter-detail="predict"]');
  await expect(forecast).toContainText(/illustrative forecast/i);
  await forecast.getByRole('button',{name:/Kylian Mbappé/}).click();
  await expect(forecast.getByRole('button',{name:/Kylian Mbappé/})).toHaveAttribute('aria-pressed','true');
  await expect(forecast.getByRole('img')).toHaveAccessibleName(/Highlighting Kylian Mbappé/);
  await chapter(page,'knowledge');
  const quiz=page.locator('[data-chapter-detail="knowledge"]');
  await quiz.getByRole('button',{name:/Boston Celtics/}).click();
  await expect(quiz.getByRole('status')).toContainText('Not quite');
  await quiz.getByRole('button',{name:/New York Knicks/}).click();
  await expect(quiz.getByRole('status')).toContainText('Correct. New York won the series 4–1.');
  await expect(quiz.getByRole('button',{name:/New York Knicks/})).toHaveAttribute('data-result','correct');
  await chapter(page,'games');
  const games=page.getByRole('list',{name:'Games to play'});
  await expect(games.getByRole('link')).toHaveCount(6);
  await expect(games.getByRole('link',{name:'Play Formula',exact:true})).toHaveAttribute('href','https://games.statoz.in/play/portfolio-formula');
  await chapter(page, 'city'); await expect(page.getByRole('navigation', { name: 'Sports grounds' })).toBeVisible();
});

test('story and directory work without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 900 } });
  const page = await context.newPage(); await page.goto(baseURL!);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('StatOz Wizard');
  await expect(page.locator('[data-journey-chapter]')).toHaveCount(7);
  await expect(page.getByRole('link', { name: 'Take a quiz' })).toHaveAttribute('href', 'https://web.statoz.in/quiz/');
  const directory = page.locator('[data-static-directory]');
  await directory.locator('summary').click(); await expect(directory.locator('details')).toHaveAttribute('open', '');
  await expect(directory.getByRole('link', { name: 'Explore Sports', exact: true })).toHaveAttribute('href', 'https://web.statoz.in/');
  await context.close();
});

test('retained pages and asset provenance resolve', async ({ request }) => {
  for (const route of ['/about', '/blog', '/blog/how-statoz-prediction-quiz-works', '/download', '/faq', '/termsAndConditions', '/privacyPolicy', '/games/pitch-duel', '/sitemap.xml', '/robots.txt', '/manifest.webmanifest', '/predict', '/assets/city/manifest.json', '/assets/journey/manifest.json']) expect((await request.get(route)).status(), route).toBe(200);
  expect((await request.get('/not-a-real-page')).status()).toBe(404);
});

test('place links open cold; landmarks use full pages; steps and credits stay in the city', async ({ page }) => {
  await page.goto('/#city/city-hall');
  const hud = page.locator('[data-city-hud]'), actions = page.locator('[data-city-actions]');
  await expect(hud.locator('h2')).toHaveText('City Hall');
  await expect(page.locator('[data-scene-status]')).toHaveAttribute('data-journey', 'false');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(actions.getByRole('link', { name: /Privacy/ })).toHaveAttribute('href', '/privacyPolicy');
  await expect(actions.getByRole('link', { name: /Terms/ })).toHaveAttribute('href', '/termsAndConditions');
  await hud.getByRole('button', { name: 'City credits' }).click();
  const credits = page.getByRole('dialog');
  await expect(credits.getByRole('heading', { level: 2 })).toHaveText('City credits');
  await expect(credits.getByRole('link', { name: 'City kit sources and licenses' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(credits).toHaveCount(0);
  await expect(hud.locator('h2')).toHaveText('City Hall');
  await hud.getByRole('button', { name: 'Next place: Basketball' }).click();
  await expect(hud.locator('h2')).toHaveText('The Blacktop'); await expect(page).toHaveURL(/#city\/basketball$/);
  await hud.getByRole('button', { name: 'Previous place: City Hall' }).click();
  await expect(hud.locator('h2')).toHaveText('City Hall');
  await actions.getByRole('button', { name: 'Back to the city' }).click();
  await expect(hud).not.toHaveAttribute('data-open'); await expect(page).not.toHaveURL(/#city\//);
  await page.goto('/#city/clubhouse');
  await expect(actions.getByRole('link', { name: /About StatOz/ })).toHaveAttribute('href', '/about');
  await page.goto('/#city/help');
  await expect(actions.getByRole('link', { name: /How StatOz works/ })).toHaveAttribute('href', '/faq');
  await page.goto('/#city/news');
  await actions.getByRole('link', { name: /How the StatOz Prediction Quiz Works/ }).click();
  await expect(page).toHaveURL(/\/blog\/how-statoz-prediction-quiz-works/);
  await page.getByRole('link', { name: 'Return to City', exact: true }).click();
  await expect(hud.locator('h2')).toHaveText('StatOz News');
});

test('wheel scrolling glides: the camera never jumps between frames', async ({ page }) => {
  await page.addInitScript(() => { sessionStorage.setItem('statoz-city-force-3d', 'true'); sessionStorage.setItem('statoz-arrival-v3', 'true'); });
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/');
  await expect(page.locator('[data-scene-status]')).toHaveAttribute('data-arrival', 'settled', { timeout: 90000 });
  await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('[data-city-scene]')!, samples: number[][] = [];
    (window as unknown as { __camera: number[][] }).__camera = samples;
    const tick = () => { const p = (host.dataset.cameraPosition || '').split(',').map(Number); if (p.length === 3 && p.every(Number.isFinite)) samples.push(p); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.mouse.move(720, 450);
  for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(90); }
  await page.waitForTimeout(2500);
  const { worst, progress } = await page.evaluate(() => {
    const c = (window as unknown as { __camera: number[][] }).__camera; let worst = 0;
    for (let i = 1; i < c.length; i++) worst = Math.max(worst, Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1], c[i][2] - c[i - 1][2]));
    return { worst, progress: Number(document.querySelector<HTMLElement>('[data-scene-status]')!.dataset.journeyProgress) };
  });
  expect(progress).toBeGreaterThan(.5);
  expect(worst).toBeLessThan(5);
});

test('nothing solid stands in a road, traffic keeps clear of the drive, and App Station uses brand art', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', request => requested.push(new URL(request.url()).pathname));
  await ready3D(page);
  await expect(page.locator('html')).toHaveAttribute('data-city-layout', 'clear');
  for (const id of ['entry', 'follow', 'predict', 'knowledge', 'games']) { await chapter(page, id); await settledCamera(page); }
  const gap = await page.locator('[data-city-scene]').getAttribute('data-traffic-gap');
  expect(gap === 'none' || Number(gap) > 3, 'closest visible traffic ' + gap).toBe(true);
  expect(requested).toContain('/assets/brand/app-icon.png');
  expect(requested).toContain('/assets/brand/statoz-wordmark-v2.png');
});

test('each idea is stated once in the opening', async ({ page }) => {
  await page.goto('/');
  const copy = (await page.locator('[data-journey-chapter]').allTextContents()).join(' ');
  expect(copy.match(/your teams/gi)?.length ?? 0).toBe(1);
  expect(copy.match(/home ground/gi)?.length ?? 0).toBeLessThanOrEqual(1);
  expect(copy).not.toMatch(/MISSION 0/);
  const headings = await page.locator('[data-journey-chapter] :is(h1, h2)').allTextContents();
  expect(new Set(headings).size).toBe(headings.length);
  await chapter(page, 'games');
  await expect(page.getByRole('list',{name:'Games to play'}).getByRole('link')).toHaveCount(6);
  await expect(page.getByRole('link', { name: 'Find my game', exact:true })).toHaveAttribute('href','https://games.statoz.in/');
});

test('city sound is off by default and starts only from the Settings toggle', async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext; let made = 0;
    (window as unknown as { __audio: () => number }).__audio = () => made;
    window.AudioContext = class extends Native { constructor(options?: AudioContextOptions) { super(options); made++; } } as typeof AudioContext;
  });
  await page.goto('/');
  await expect(page.locator('[data-enhanced]')).toHaveAttribute('data-enhanced', 'true');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const toggle = page.getByRole('button', { name: /City sound/ });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => (window as unknown as { __audio: () => number }).__audio())).toBe(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => (window as unknown as { __audio: () => number }).__audio())).toBe(1);
  await toggle.click(); await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});
