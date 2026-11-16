# Your First Drive

The homepage is one continuous Three.js city. While it loads, the StatOz logo
is reforged from its scattered fragments in deep space. When it is whole the logo
glides into the header, sparkling particles gather out of the stars into
"Welcome Home, StatOz Wizard.", which turns into solid glowing text, holds, and
zaps away in an electric glitch. A warp follows and the camera dives from orbit
onto the plaza facing the gate while the grounds' floodlights switch on one by one
and rooms light up outward from the entrance. Without stopping, the camera carries
on down the avenue to the waiting coupe and halts at "Enter StatOz City"; the
welcome view itself shows no copy in the 3D city. Scrolling on, the camera orbits
into the driver's seat, the car passes through
the StatOz City gate, and four optional mission previews introduce following
sports, predictions, quizzes and games. The drive ends at the explorable city,
where the car becomes player-controlled (see [CITY-FREE-ROAM.md](CITY-FREE-ROAM.md)).

## Arrival

`city-runtime.ts` draws the loader on the same canvas as the city.
`city-crest.ts` models the icon from its own parts. The slab, with the goal line
and pitch, carries the unmodified `app_logo.png` with continuous UVs, broken into
about 20 seeded Voronoi shards of deliberately uneven size. A recessed goal mouth sits
behind it. The ball is flat: the icon's own octagon, measured from the image and
cut from it, so it is exactly the logo's ball.

The build runs on its own clock for about eight seconds:

| Clock (s) | What happens |
| --- | --- |
| 0 | Dull, dark fragments drift and tumble in a wide field while the whole logo slowly turns to face the viewer. |
| 1.1 | Lightning from an energy core at the goal strikes the fragments one by one, sweeping around the circle. Each one lights up, its edges glow, and it trembles, winds back and turns to face forward. |
| 2.4 | Fragments are pulled home on curving paths, slowly at first and then snapping into place. Each landing sends sparks and a jolt through the logo, and glowing cracks remain between the pieces. |
| 4.8 | The goal mouth forms behind the closed frame. |
| 5.1 | The flat ball rises from below, spinning like a coin, then hovers in front of the goal with lightning crackling from the posts. |
| 5.9 | The hold. If the city is still loading, the ball keeps hovering until it is ready. |
| 6.6 | The ball slams home: a flash, a shockwave, and the cracks flare white-hot and cool outward. |
| 7.3–8 | The fragments become one seamless slab and a soft shine passes over it. |

The counter follows real loading and never runs ahead of the build, so it reaches
100 as the ball lands. The clock advances at most 1/20 s per frame, so a slow frame
never skips a beat. A revisit in the same tab plays it about three times faster,
and wheel, touch or key input hurries the build once the city has loaded.

The city's shader programs compile in small slices between loader frames. The first
city frame, which still links shadow programs and uploads textures, is drawn only
when the logo is complete and still. On the test laptop the longest pause during
the build is about 0.3 s. The logo then glides into the header on a gentle arc over
about 1.5 s.

`city-intro.ts` holds the rest of the opening, timed by `INTRO` in seconds after
loading reaches 100:

| Reveal (s) | What happens |
| --- | --- |
| 0–1.5 | The logo glides into the header. The backdrop is space: three twinkling star layers, cyan and magenta nebulae, and the night side of a planet whose limb glows with the city's street grid. |
| 0.55–2.75 | About 18,000 particles (7,000 on phones) curve in from the starfield and lock onto the pixels of the page's own `h1`, roughly left to right. A few flare as four-point stars; a sweep of light crosses them at 2–2.8. |
| 2.6–3.0 | Solid: the particles fade while the real `h1` glows in over them (`data-intro-text=solid` on the shell). A sheen crosses "StatOz Wizard." |
| 4.0–4.5 | Zap (`data-intro-text=zap`): a CSS glitch with slices and a red/cyan split, then the text collapses to a line of light and goes out. About half the particles flare back as sparks. |
| 4.2–5.3 | The warp: stars stretch into streaks and the planet rushes up to fill the frame. |
| 5.05–5.7 | A brief cyan light, then the backdrop opens onto the city seen from about 240 units up. |
| 5.0–7.4 | The camera dives from orbit to the plaza facing the gate (`applyDive`, applied after the drive pose). The city's lights come on during the descent. |
| 6.8–9.6 | The page scrolls itself from the welcome view to the `entry` anchor, so the drive camera carries on down the avenue onto the coupe and stops at "Enter StatOz City". |
| 7.2 | `data-intro-landed` is set on the shell; the header nav and the scroll cue fade in. |
| 9.8 | Settled. |

In the 3D city the welcome view shows no eyebrow, headline or description; the
`h1` stays in the page for assistive technology, and the simple and failed-WebGL
views keep all their copy.

The reveal is timed in frames, not wall-clock time, so a slow frame never skips a
step. It plays once per tab session. Any wheel, touch or key input skips it and
hands the scroll back at once, and a revisit, a place link or a mid-page arrival
lands in the settled city. The headline is painted very dimly at first paint so
the largest paint stays fast. Sound is off by default and only starts from Settings.

## Motion

Mouse-wheel scrolling is inertial (`city-scroll.ts`). Touch, keyboard, scrollbar,
anchors and assistive scrolling keep their native behaviour, dialogs keep their
own scrolling, and reduced motion never installs it. `city-journey.tsx` publishes
the target progress from the document scroll. The runtime eases a display progress
toward it every frame. The camera, car, particles and chapter copy all read that
display value, so they move together. Large jumps (chapter links, replay) snap.

`city-drive.ts` owns the drive camera. Moves between poses are cubic Bezier crane
shots that rise away from the start, travel high and settle into the next pose,
rather than straight blends that cut through stands. The hero has a slow push-in
and leans gently toward the pointer on desktop.

Mission copy is fully revealed as its chapter begins and leaves before the camera
moves. Headings rise behind a mask, then descriptions, then controls.

## The coupe

`city-drive-car.ts` is a smooth lofted body with wheel arches, panel lines, a
full-width front light bar, projector lamps, a continuous tail strip, a diffuser,
neon skirts, five-spoke alloys and calipers. It has a glazed cabin with pillars and
a roof header, and a driver in a helmet whose gloved hands are pinned to the wheel
rim and follow the steering. From the driver's seat the windshield glass shows
faint reflections and dust. A gauge cluster and route screen show speed, the next
stop and the route; the steering wheel turns, and brake lights, body roll and
tail-light trails respond to the drive. On portrait phones the roof panel slides
open from inside so the road stays in view.

## City entrance and roads

`city-gateway.ts` builds a raised plaza of wet granite with a mirror floor on
desktop. From there an avenue of uplit trees runs to one calm gate: two tapered
pylons whose light seams rise as the car approaches, and a floating lintel
carrying the 3D emblem and "STATOZ CITY" in metal letters, set in a subset of
Droid Sans Bold (Apache 2.0). The sightline through the gate is kept clear of
signs. Before the gate the grade is cyan and white; the city's colours bloom as
the car passes under it.

`city-roads.ts` draws every street, junction and crossing as one road mesh. A
shader paints lane lines, crossings, glowing edges and wet patches, and real kerbs
step up to the pavements. A layout audit checks every solid footprint against the
road and pavement corridors and publishes the result as `data-city-layout` on the
root element. Traffic keeps to the left and stays clear of the coupe during the drive.

## Missions and navigation

1. Cricket / Follow: choose a sport; its ground lights up and throws sparks.
2. Football / Predict: choose the result of a labelled sample match.
3. Basketball / Quiz: answer a free-throw question with immediate feedback.
4. Racing / Play: select Hoop Legacy, Cricketer or Formula and launch its real
   Games destination; the full catalogue link remains available.

Each idea is stated once: the eyebrow names the stop, the heading makes the
promise, the description says what the product does, and the button says what
happens next. Previews are optional and labelled, and session storage keeps
choices for this tab only. The route navigation appears after the first scroll.

Sports opens https://web.statoz.in/ and Games opens https://games.statoz.in/.

## Assets, quality and fallbacks

The coupe, driver, logo model, gate, plaza, particles and light effects are
authored locally. The App Station phone shows only the existing app icon and
wordmark from `public/assets/brand`; no app screens are invented.

Run `node scripts/capture-journey.mjs` against a local server (`CITY_TEST_URL`
selects its origin) to capture seven desktop and mobile poster pairs from the real
scene. Reduced motion and unavailable WebGL use these posters, skip the loader,
and keep working mission previews, product links and the static city map. Without
JavaScript the chapters flow normally and the directory remains usable.

All drive, logo and particle materials are compiled before the first city frame.
Light membership never changes at runtime (only intensity), and shadows use PCF
directly, because the deprecated soft-shadow type is swapped at render time and
would force every program to recompile. Browser emulation and software rendering
measurements are not physical-device certification.

## Verification

Run `npm run check`, `npm run build`, then `npm test` (or `CITY_TEST_PORT=4410`
against the dev server). Coverage includes the arrival (loader, logo landing,
once per session, skip on input), frame-to-frame camera continuity on a wheel
scroll, the road layout audit and traffic clearance, App Station brand art, copy
duplication, sound defaulting to off, cockpit reversal, missions, accessibility at
four widths, touch scrolling, reduced motion, no JavaScript, legacy links, free
roam and the retained pages.
