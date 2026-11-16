# StatOz City validation

## Logo reforging · 16 November 2026 (current)

The loader logo now reassembles from scattered fragments, charged by lightning, over about eight seconds on its own clock. The ball is the icon's flat octagon, cut from the logo image instead of a faceted 3D ball. See [JOURNEY.md](JOURNEY.md#arrival). Local only; nothing was pushed or published.

**Startup freeze fixed.** A 5.8–7.4 s freeze occurred on the first city frame. A frame trace showed about 20 shader programs linking one after another inside `getProgramInfoLog`. The plaza mirror, added in the previous pass, hid moving objects while it rendered the reflection, and those objects included the coupe's lights. The different light count gave every reflected material a second program variant, which pre-compilation never produced. Changes:
- The reflection now hides only the meshes of moving objects; lights stay on.
- City shaders compile in slices of about 10 ms between loader frames.
- The final compile pass skips the merged source meshes, which are never drawn.
- The first city frame is drawn once the logo is complete and still.

- `npx tsc --noEmit` and `npm run build`: passed.
- All three browser suites against the production build (port 4412): 34 passed in 6.2 minutes.
- Loader frame gaps on the test laptop: the longest during the build is about 0.3 s (previously 5.8–7.4 s). The remaining 0.9 s first city frame happens while the logo is still. Fresh load to settled city: about 15 s on the test laptop.

| Measurement (production, RTX 3070 Ti laptop) | Previous pass | Now |
| --- | --- | --- |
| Desktop hero, 1440 px | 59 fps, about 1,225 draw calls | 67 fps, 1,219 draw calls |
| Phone width, 390 px | 75 fps, 408 draw calls | 75 fps, 405 draw calls |
| Lighthouse mobile Performance (simulated, 4x CPU) | 56 | 70 and 69 in two runs (a first, cold run scored 50) |
| Lighthouse LCP / TBT (simulated) | 3.4 s / 2.4 s | 3.3 s / 0.91–0.97 s |
| LCP observed in the Lighthouse trace | n/a | 0.28 s (the loader's flat logo) |
| Lighthouse Accessibility / Best Practices / SEO | 100 / 100 / 100 | 100 / 100 / 100 |

The hero is still over the 650 draw-call budget. Not verified: physical phones.

## Opening revision · 16 November 2026

Covers the arrival (logo built from the icon's parts during loading, lights-on reveal), the plaza, avenue and gate, inertial scrolling with an eased camera, the rebuilt coupe with driver and windshield view, the road network and layout audit, particles, App Station, copy de-duplication, the cursor ring and optional sound. See [JOURNEY.md](JOURNEY.md). Local only; nothing was pushed or published.

- `npx tsc --noEmit` and `npm run build`: passed.
- All three browser suites against the production build (`CITY_TEST_PORT=4411 npx playwright test`): 34 passed in 3.6 minutes, with no failures or skips. The suite was also run green against the development server.
- New checks: the arrival (loader, logo landing in the header, once per tab session, input skips the reveal); frame-to-frame camera continuity on a 14-notch wheel scroll (largest step 2.06 m, limit 5 m); `data-city-layout` reports no solid footprint in any road or pavement; the closest visible traffic during the drive is more than 3 m away; App Station draws the real brand icon and wordmark; key phrases appear once; sound is off and creates no AudioContext until it is turned on in Settings; reduced motion skips the loader.
- Updated checks: the drive reverses through the cockpit to the same car position; chapters reverse to the same resting camera; the header has one Settings button; posters for the seven current chapters.

| Measurement (production, RTX 3070 Ti laptop) | Before | Now |
| --- | --- | --- |
| Desktop hero, 1440 px | 75 fps over the old busy city | 59 fps (the plaza mirror is visible here) |
| Desktop, every other journey point sampled | 75 fps | 75 fps (display cap) |
| Phone width, 390 px | 75 fps | 75 fps; 408 draw calls; 457,110 triangles |
| Largest contentful paint, real load | about 1.1 s | 0.36 s desktop (headline), 0.6 s phone (loader logo) |
| Lighthouse mobile Performance (simulated, 4x CPU) | 70 | 56 |
| Lighthouse LCP / TBT (simulated) | 1.06 s / 1.45 s | 3.4 s / 2.4 s |
| Lighthouse Accessibility / Best Practices / SEO | 100 / 100 / 100 | 100 / 100 / 100 |

Startup script work is now the main limit. The refinement and free-roam revisions add rigged characters and a 1,437-solid collision index. This revision adds the road network, district facades, gate, plaza and loader logo. Under Lighthouse's 4x CPU slowdown, the city build and shader warm-up take about 9 s of scripting, which the loader now covers with real progress. The hero falls short of the desktop budget of 650 draw calls: about 950 calls without the mirror floor and about 1,225 in frames that also redraw the reflection. Fixes made during this pass:
- Shadows now request PCF directly, because three.js swapped the deprecated soft type at render time and invalidated every pre-compiled program, causing a 5 s first-frame stall.
- Light intensity changes but lights are never added or removed.
- The reflection reuses the frame's shadow maps, skips small moving objects and refreshes on alternate frames.
- Each coupe's static parts are merged by material.
- The loader's placeholder logo is hidden rather than removed, which had pushed Lighthouse's LCP to 10.2 s.

Not verified: physical Android and iOS Safari devices, and a physical gamepad. Phone figures are browser emulation on a laptop GPU.

## Earlier revisions

The subsequent [Free roam revision](CITY-FREE-ROAM.md) adds player driving and walking after the journey. Its combined targeted production run passed 19 checks, followed by focused input and visual regression checks. Refer to that record for controls, collisions, camera ownership and desktop/phone screenshots.

The 16 November city visual refinement has a separate [implementation, research and QA record](CITY-REFINEMENT.md), with 15 targeted browser checks, new asset integrity checks and current desktop/phone screenshots. The measurements below describe the preceding revision.

Recorded on 15 November 2026 against the local production build of the night-match revision: the venue HUD, rebuilt grounds and landmarks, the filled district and the night lighting, alongside the opening journey. The implementation is local only; nothing was pushed or published.

## Automated checks

- `npm run check`: passed.
- `npm run build`: passed, including TypeScript and generation of the existing routes.
- `npm test`: 18 passed in 46.2 seconds. [Machine-readable report](qa/browser-results.json). One earlier full run failed once in the entrance test while waiting for hydration; it passed in three isolated runs and three later full runs, so treat it as a possible timing flake to watch.
- No dependency changes in this refinement. The preceding dependency audit reported zero vulnerabilities.
- The preceding destination checks returned HTTP 200 for Sports and Games: `https://web.statoz.in/` and `https://games.statoz.in/`.

The browser suite covers loaded 3D assets at 375, 768, 1024, and 1440 pixels; label collisions with fixed controls; dock typography fitting within its cells; all four venue destinations; clicking a rendered ground; scroll tours and orbit controls; touch swipes and dragging; landscape layout; the place HUD, its action cards, previous/next stepping, keyboard focus, Escape, browser Back, cold place links, landmark links to full pages, and the city guide and credits dialogs; news articles and retained pages; reduced motion; JavaScript-disabled navigation; and WebGL loss/recovery. The new activity test verifies the populated scene, pause/resume, and available exploration controls while paused. Automated axe accessibility checks passed at all four primary widths.

A separate software-renderer probe confirmed that the default SwiftShader browser enters Simple view, retains all nine destinations, passes axe checks, and exposes an explicit Explore in 3D action.

## Production performance measurements

The test browser was full Chromium on Windows with an NVIDIA GeForce RTX 3070 Ti Laptop GPU. These are local laboratory results, not field measurements or physical-phone benchmarks. [Scene measurements](qa/city-performance.json) and [full Lighthouse report](qa/city-lighthouse.json).

| Measurement | Before the revision | Now |
| --- | --- | --- |
| Desktop city overview, 1440-pixel viewport | 75.0 fps; 351 draw calls; 363,230 triangles | 75.0 fps; 576 draw calls; 529,943 triangles |
| Mobile city overview, 390-pixel viewport on the same laptop GPU | 75.0 fps; 248 draw calls; 226,780 triangles | 75.0 fps; 361 draw calls; 341,518 triangles |
| Lighthouse mobile Performance | 74/100 | 70/100 |
| Lighthouse Accessibility / Best Practices / SEO | 100 / 100 / 100 | 100 / 100 / 100 |
| Largest contentful paint | 1.07 seconds | 1.06 seconds |
| Cumulative layout shift | 0 | 0 |
| Total blocking time | 1.39 seconds | 1.45 seconds |

Lighthouse used simulated mobile networking and 4× CPU slowdown. Its final run had no runtime error or warnings. The measured LCP and CLS meet the planned 2.5-second and 0.1 thresholds, and desktop animation meets the 60-fps target. A 390-pixel viewport on this GPU does not establish the 30-fps physical-phone target.

The poster and HTML controls appear before the 3D runtime loads. Models and asynchronous shader warmup finish before rendering begins. Building the larger city in one task first raised total blocking time to 2.20 seconds (Lighthouse 66). The world is now built in stages and its geometry merge pauses every 24 ms, which returned blocking time to 1.45 seconds. Draw calls and triangles rose by roughly half; frame rate on this GPU is unchanged at the display's 75 Hz cap, which says nothing about phones. Startup CPU work remains the main performance limitation; a 70 score is not a claim of a fully optimized mobile release.

Before public release, measure startup responsiveness, sustained rendering, memory, touch gestures, and recovery on physical Android hardware and iOS Safari. Confirm production CDN caching and compression when a deployment is authorized. Simple view remains available for reduced motion, missing WebGL, software rendering, and user preference.

## Visual review

Screenshots show the actual rendered city and were reviewed alongside browser checks:

Arriving at a place keeps the city sharp: the venue is the artwork, its name and story sit on the left, and its actions replace the dock. Each of the nine places was reviewed at 1440 pixels and at phone width, and the HUD was measured against the action cards at 1920×1080, 1366×650, 1280×600, 1024×768 and 812×375 with no overlap. The night-match lighting, twelve stands, about 336 people, rebuilt landmarks and district are documented in [CITY-DETAILS.md](CITY-DETAILS.md). The current suite writes the journey screenshots below; the city and venue images further down predate this revision.

- [Journey, 1440 pixels](qa/journey-1440.png), [1024](qa/journey-1024.png), [768](qa/journey-768.png), [375](qa/journey-375.png)
- Earlier refinement: [desktop, 1440 pixels](qa/city-1440.png)
- [Laptop, 1024 pixels](qa/city-1024.png)
- [Tablet, 768 pixels](qa/city-768.png)
- [Phone, 375 pixels](qa/city-375.png)
- [Phone landscape](qa/city-landscape.png)
- [Basketball players and stand](qa/city-life-basketball.png)
- [Cricket players and stand](qa/city-life-cricket.png)
- [Football players and stand](qa/city-life-football.png)
- [Circuit, spectators, and pit crew](qa/city-life-racing.png)

The city uses free CC0 models from Kenney and the Standard edition of Quaternius Downtown City MegaKit. Optimized models, textures, and the transcoder are served locally. [Asset provenance](../public/assets/city/manifest.json) records sources, licenses, hashes, and modifications; [authored detail provenance](../public/assets/city/authored-details.json) records the original figures, stands, and source-model palette adaptations. [CITY.md](CITY.md) explains rebuilding and implementation.

## Reproduce

Run `npm run check` and `npm run build`, then `npm test`. The tests use full Chromium with hardware acceleration. Set `CITY_TEST_PORT=4411` to run beside the development preview on port 4410.

With production running on port 4411, run `node scripts/performance-city.mjs` for scene measurements and Lighthouse. `node scripts/probe-city.mjs --software-only` checks the software-rendering fallback. Set `CITY_TEST_URL` to use a different local port.

`node scripts/inspect-city-life.mjs` captures all four venues close up and compares frames a second apart to confirm rendered activity, rather than just checking a clock value. The script reports browser errors and the instantiated crowd/athlete/stand counts.

The older [QA.md](QA.md) documents the previous stadium homepage and is retained as historical evidence.
