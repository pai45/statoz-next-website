# Free roam in StatOz City

After the opening journey reaches the city, the coupe becomes player controlled. A cold link to a place retains that place's existing HUD. The visitor can leave free roam for the overview at any time and return through **Settings → Free roam**. The player's position and parked car survive that switch for the current scene session.

The desktop view now has one Settings button in the header. Vehicle actions, camera distance, city activity, sound, view selection, and the keyboard guide live in its native modal. Opening Settings suspends player input; vehicle/camera actions close it and run after the controller resumes. The refresh/overview icon, Explore chip, and Replay journey button have been removed. The introductory hint disappears after four seconds and stays dismissed when visiting a place or changing vehicle.

The compact map sits at the bottom center. It is an isometric vector relief of the same district, with extruded building silhouettes, raised sports grounds, contour lines, roads, the parked car, and a heading marker projected into the same coordinates. Its static geometry is memoized; no canvas or renderer is added. Desktop movement buttons are hidden by default and can be enabled in Settings. Touch/phone layouts retain a compact direction pad and vehicle/brake controls.

Nearby visits use a floating world waypoint rather than a boxed message above the minimap. The city camera projects the destination's actual position each frame; a small diamond, name and distance sit in its direction. When the place is behind the camera or off-screen, a subtle chevron moves to the matching safe screen edge. Marker bounds reserve space for the header, minimap and phone movement controls. Clicking it or pressing F retains the existing visit flow. Updating the marker position does not rerender React every frame.

The visibility refinement gives the waypoint a compact translucent StatOz plate with clipped corners and no perimeter border or colored glow. It uses the StatOz display typeface, larger 14px desktop/13px phone labels and a stronger directional glyph. Its click target is at least 180 × 66px on desktop or 160 × 62px on phones. The secondary line explicitly says **Press F** or **Tap to visit**, alongside distance. The map remains unframed and transparent.

## Controls

| Action | Keyboard | Screen controls |
| --- | --- | --- |
| Drive or walk | WASD / arrow keys | Direction pad; multiple buttons can be held |
| Brake | Space | Brake |
| Drive faster / run | Shift | Run toggle while on foot |
| Park and step out / enter the nearby car | E | Step out / Enter car |
| Visit a nearby location | F | Nearby-place prompt |
| Look around | Drag the scene | Drag the scene |
| Switch camera distance | C | Settings → Change camera distance |
| Reset player and car to the arrival street | R | Keyboard shortcut |
| Leave free roam | Escape | Settings → City overview |

Basic left-stick movement is accepted from a connected gamepad, but this release was not tested with physical gamepad hardware. Keyboard and touch-style screen controls remain available for every action.

The car stays where it was parked, appears on the minimap while walking, and can be entered only from nearby. Stepping out automatically stops it and finds an unobstructed space beside or behind it. If every exit is obstructed, the visitor can reverse or reset. Visiting a sports ground or city landmark suspends movement and opens the existing destination HUD; returning resumes at the saved player position. External Sports and Games links remain the existing real product destinations.

## Implementation

- `city-roam.ts` owns the player car, original jacket/visor/backpack avatar, action state, pedestrian gait, vehicle steering, third-person camera and nearby-place detection. The coupe reuses the authored journey car's geometry, wheel/steering motion and lights. It uses the existing scene/canvas/render loop.
- `city-roam-physics.ts` builds a spatial hash from actual city solids. Movement uses small swept steps, pedestrian wall sliding, three collision circles for the car, district bounds and a sampled collision spring arm. The parked player car is also solid when on foot. This is a street exploration controller: it does not add interiors, jumping, stunt physics or gameplay inside the sports products.
- `CityWorld.roamSolids()` reads individual meshes retained behind the material batches after all local assets have settled; tree trunks receive separate small colliders. Overhead structures do not become invisible walls at street level.
- `city-runtime.ts` gives the player camera exclusive ownership in roam mode. Journey, orbit and venue transitions retain their own ownership. Movement pauses for the existing activity control, place HUD and dialogs. Blur, hidden tabs, pointer cancellation, mode exit and disposal release inputs. Camera look remains available while activity is paused.
- `city-roam-hud.tsx` and its scoped stylesheet provide semantic buttons, the minimap, speed, nearby-place action, screen movement and a visible route back to the overview. Position telemetry is published about eight times a second rather than rerendering React on every frame.
- Body scrolling and inertial wheel handling are suspended only while roaming; normal scrolling is restored when returning to the overview, opening a place, switching to Simple view, losing WebGL, replaying, or unmounting. Reduced-motion and unavailable-WebGL visitors retain the static directory; free roam is offered only in 3D.

## Verification

Run `npm run check`, `npm run build` and `CITY_TEST_PORT=4411 npm test -- tests/city-roam.spec.ts`. The suite checks wall sweeps, pedestrian sliding, camera occlusion, level bounds, the automatic journey handoff, actual driving and walking, entering/exiting the parked car, pause, blur, touch-style pointer release, minimap/control accessibility, phone/landscape fitting, visiting a location and returning to the player. Existing overview tests explicitly return to the overview after the handoff so they continue covering the directory and orbit UI.

Recorded on 16 November 2026: the production build and TypeScript passed. The combined targeted suite passed 19 checks in 2.6 minutes, including the previous asset, accessibility, navigation and WebGL-recovery checks. After the camera-release and on-foot reset corrections, all four focused free-roam checks passed again. The browser test observes actual player positions and verifies that movement stops on blur and during activity pause. The camera-release test holds movement while dragging/releasing the view, and the reset places an on-foot player beside the parked car rather than inside it.

The final venue-return screenshot check explicitly verifies the old venue HUD is removed from the driving layout. One isolated attempt jumped during the opening reveal; the helper now waits for the arrival to settle before simulating journey completion. The visual check then passed with a clear player view.

Review screenshots in `docs/qa/roam-desktop.png`, `docs/qa/roam-phone.png` and `docs/qa/roam-avatar.png`. Browser phone/landscape checks are emulation; physical phone and iOS Safari verification remain separate. Work is local, with no publication or remote changes.

The declutter revision adds `docs/qa/roam-clean-desktop.png` and `docs/qa/city-settings.png`. Its focused checks cover the four-second hint timeout, hidden desktop controls, map dimensions/centering, Settings accessibility and input suspension, action handoff, touch controls, and the existing city destinations.

The hint test records its actual insertion/removal times with a DOM observer. During this check, the journey-to-player handoff exposed a shader compilation stall caused by toggling headlight membership. Headlights now stay registered and change intensity, while the car and avatar are precompiled with the city during loading. This keeps the first interactive frame from delaying the four-second dismissal. Map headings are projected through the same isometric transform as streets and player positions.

Final declutter validation: production build and TypeScript passed; all 16 targeted production checks passed in 1.8 minutes. This includes Settings/phone accessibility, actual car/avatar commands, the measured hint timeout, compact bottom-center map bounds, pointer cancellation, input suspension, city activity, WebGL recovery, retained routes and venue return. Phone layouts remain browser emulation.

Directional waypoint validation: the latest borderless StatOz refinement passed the production build/TypeScript and both focused projection/visit checks. At 1440px and emulated 390px, turning the view reverses the marker's screen side while the player stays still; the borderless clipped plate stays inside safe viewport bounds, passes the HUD accessibility audit, and still opens App Station. Reviewed screenshots: `docs/qa/city-waypoint-1440.png` and `docs/qa/city-waypoint-390.png`. The existing touch/control and Settings checks passed during the preceding directional-marker revision.
