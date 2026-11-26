# City detail direction

Refinement recorded 15 November 2026. Keep the existing homepage layout, concise heading, palette, venue actions, and navigation. StatOz's angular surface tokens replace rounded control chrome; continuous clipped borders follow the same pattern as the shared FilterChips component.

The city's semantic font tokens map to the actual local Orbitron and Space Grotesk faces loaded by the application. Dock spacing adapts at tablet and phone sizes so the display type fits each destination cell.

## Technical frame

- Three.js 0.184, WebGL2, one perspective canvas, desktop and touch browsers.
- A citizen is approximately 2.2 world units tall. Jerseys use the existing sport accents, with matte clothing, varied skin tones, low-poly hair/caps, articulated limbs, and shoes.
- Original geometry, no new model downloads, texture atlases, external requests, or character licenses. Existing Kenney/Quaternius sources retain their recorded CC0 licenses.
- Target fewer than 400 people. Current desktop composition: about 330 people, including 55 pedestrians (36 at phone width), 24 athletes, about 250 seated spectators, and 3 pit marshals. Twelve stands offer a scattering of occupied seats, so the crowd has gaps without a rule for leaving them. Seated spectators are re-posed a quarter at a time, which keeps per-frame work below the earlier 166-person scene.
- Six instanced batches draw heads/hair, jerseys, shorts, limbs, shoes, and balls. One additional mesh draws the cricket bat. Instance transforms use shared scratch objects; React does not update per frame.
- Figures have a stable ground pivot. Seated figures match terrace heights. Walkers follow fixed paths within city blocks and the plaza; athletes stay within their pitches.

## Night match revision

Recorded 15 November 2026, after a review found the grounds flat, the landmarks to be placeholder boxes, and the city mostly empty ground.

- Lighting: hemisphere and moonlight are dim and cool. Each ground carries one unshadowed point light tinted with its accent, plus masts whose beams are a single merged additive mesh that fades at its silhouette and toward the ground. Street lamps, signs and doorways drop additive pools on the ground. Fields keep a little emission so they read as floodlit on mobile, which has no bloom.
- Grounds: stands are tiered with bays, aisles, flank walls and optional cantilever roofs. Tall stands sit north and west; the south-east stays low or open, and the near-side floodlight mast is omitted, so the pitch is visible from the overview and from each venue camera.
- Landmarks: the Clubhouse is a pavilion with a pitched roof, veranda and clock turret; the newsroom has a studio, two scrolling ticker bands and a mast beacon; App Station is a transit canopy beside a phone-shaped screen showing the store app icon; the Visitor Centre is a round pavilion under an information beacon; City Hall has steps, a colonnade, a pediment and a dome.
- District: pavements and kerbs stop at junctions; every approach has a crossing; four central junctions have signals. A shop row, a park with a pond, a kiosk concourse, a car park and two billboards for the StatOz products fill the blocks. Building-kit plots are sized to their strips so nothing overhangs a road.
- Horizon: 52 lit towers on mobile and 75 on desktop ring the district, tallest to the north. Several hundred instanced silhouettes and a few thousand point lights continue to a hazed horizon under a gradient sky with stars. The sky travels with the camera.
- Signs are drawn at the proportions of their boards and type shrinks to fit. Scoreboards and screens show venue names and taglines only; no scores, crowds or results are invented.
- Budget on the test laptop at the overview (production build, including shadow and post-processing passes): 576 draw calls and 530,000 triangles on desktop, 361 draw calls and 342,000 triangles at phone width. Sustained rates below 28 fps drop bloom, shadows, resolution and the four venue lights. The world is built in stages and its geometry merge yields every 24 ms to keep startup blocking time near its earlier level; see [CITY-QA.md](CITY-QA.md).

## Motion

Basketball has a dribble and shot loop; football has running players, goalkeepers, and a passing ball; cricket has a run-up, delivery, batter, and fielders. Spectators occasionally cheer. These are illustrative scenes, not representations of live matches.

Pause city activity freezes people, balls, cars, and traffic while camera navigation stays available. Resume continues the existing timeline. Reduced motion starts in Simple view; opting into 3D with reduced motion leaves world activity frozen. Hidden tabs stop rendering.

## Placement corrections

- The racing platform, runoff, gantry, cars, picking bounds, and label share the manifest's revised position. Its footprint fits between the streets instead of covering the roads at x=82 and z=48.
- The duplicated pit garage is removed; the pit structure and marshals occupy the infield.
- Commercial and downtown models occupy separate bounded plots. Normalization subtracts each model's existing root offset, retaining the correct ground pivot. Width/depth limits keep models off roads and playing surfaces.
- Duplicate miniature buildings and overlapping perimeter blocks are removed. Hedges are moved out of the new stands and pedestrian paths.
- Walking soles, seated feet, athletes, marshals, and vehicle wheels are aligned to their pavement, terraces, playing surfaces, or track, rather than sharing a floating origin height.
- Venue labels have anchor dots and thin leader lines. Placement reserves room around the header, heading, dock, view controls, and other labels. The phone camera is slightly wider so the city fits more comfortably.

## Validation

Review the aerial view, each focused venue, portrait/landscape layouts, label intersections, activity pause/resume, and renderer statistics. `scripts/inspect-city-life.mjs` captures venue details and checks that rendered frames change over time. The production browser suite checks label placement and pause behavior alongside the retained navigation/accessibility checks.

Source records: [authored-details.json](../public/assets/city/authored-details.json), [CC0 asset manifest](../public/assets/city/manifest.json), [current QA](CITY-QA.md).

## Streets: pedestrians and traffic

- **People.** Everyone in the city is a [Kenney Mini Character](https://kenney.nl/assets/mini-characters) (CC0): thirteen citizens on the streets and in the stands, the worker as circuit marshals, a citizen as the free-roam avatar and another at the coupe's wheel. The characters share one rig with rigid weights, so `city-kenney.ts` splits each into six rigid parts and bakes the kit's clips (idle, walk, sprint, sit, cheer, phone, gesture, shoot, swing, crouch, drive) into bone poses; the whole crowd is one batched draw call posed from those frames. Players, marshals and some fans wear a team colour on the shirt. Adults stand about 1.46 units tall (`SIZE = .75` in `city-life.ts`); strides and hand-held balls and bats scale with them, and walking speed follows the square root of that size. Sizes vary slightly, a quarter of pedestrians walk in pairs, and a few children walk beside a parent; soft contact shadows ground everyone on open ground.
- **Where people walk.** Pedestrians route with A* over a pavement graph: corners of every junction, the pavements between them, the painted zebras, and the walkway between the Clubhouse and the Blacktop. They pick weighted destinations (venues and the plaza are popular), wait at the kerb until the signal stops the crossing traffic and nothing is still rolling towards the zebra, then idle on arrival (looking around, on the phone, chatting with a companion) before choosing somewhere new. Walkers in the in-block hangouts (concourse, promenades, fountain plaza) stroll back and forth with stops. Steering keeps people apart and steps them round lamp posts, signal posts, planters and trees (the same solids free roam collides with).
- **Vehicles.** Street traffic is the [Kenney Car Kit](https://kenney.nl/assets/car-kit) (CC0): sedan, sports sedan, sports hatchback, SUV, luxury SUV, taxi, police car, van, delivery trucks, trucks, ambulance, garbage truck and fire engine, with emergency and heavy vehicles kept rare. The circuit runs the kit's two race cars. Wheels spin with speed and the front pair steers; each model's real headlight and tail-light faces are found by colour and position and drawn self-lit, and headlights throw soft pools on the road. A sedan is 3.3 units long and every model shares its scale (the race cars are 3.15 long); the StatOz coupe keeps its own size. One batched mesh draws every body and wheel, a second the lamps.
- **How traffic drives.** Cars keep to the left lane, follow the car ahead with a safe gap, stop at signals (the central signal heads show the live phase), give way to people on zebras, and turn right across oncoming traffic only when it is clear (one of an opposing pair at a time). A car never enters a junction without room beyond it. At the far ends of the streets, out of sight, cars turn round instead of disappearing; nothing appears or vanishes in view. In free roam, a car held behind the parked coupe overtakes when the oncoming lane is clear, or turns round.
- **Keeping clear of the coupe.** During the opening the coupe sweeps its route in a fraction of a second, so traffic never uses a lane or junction movement that passes within 3.2 of that route; lanes that would only lead into such movements are left out too. `data-traffic-gap` (checked by the browser tests) stays above 3.
