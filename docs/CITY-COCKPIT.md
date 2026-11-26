# StatOz cockpit and dashboard navigation

The driver view now uses textured dashboard, steering-wheel, seat, door-panel and console meshes. The previous slab dashboard, plain ring wheel and oversized placeholder arms have been replaced. Stitched charcoal upholstery, vent louvers, button clusters, rotary controls, a glovebox, muted metal trim and thin cyan ambient lighting keep the cabin consistent with the city.

## Reference and licensed substitutes

The layout reference is Ford's [Mustang interior description and photographs](https://www.fromtheroad.ford.com/eur/en/articles/2024/new-ford-mustang-is-an-icon-reborn): a driver-focused instrument cluster, a central navigation display, stitched trim and tactile wheel controls. The finished cabin uses original StatOz display graphics and unbranded substitute meshes.

- [Grab3D Car Dashboard](https://grab3d.com/models/vehicles/car-dashboard/) supplies the molded dashboard, vents, switches, lower console and hub-pivoted steering wheel.
- [Grab3D Modern Car Interior](https://grab3d.com/models/vehicles/modern-car-interior/) supplies the front seats, interior door panels, armrests and center console.
- Both models are CC0. Their creator discloses procedural Blender generation with AI-assisted scripts. The license is retained at `public/assets/city/licenses/Grab3D-Interior.txt`; exact source links and hashes are in `public/assets/city/manifest.json`.

Download `car-dashboard.glb`, `modern-car-interior.glb` and the license into `.cache/interior-source/`. Run `node scripts/prepare-city-cockpit.mjs` after the base city asset preparation. The script selects useful connected surfaces, removes the source's static screen graphics and display housing, mirrors the dashboard to right-hand drive, fits the seats/doors to the fastback, recolors upholstery/trim, reduces maps to 1024px, generates tangents and applies Meshopt compression. The local runtime GLB is approximately 2.02 MB, with four meshes and nine PBR texture maps. Source topology and quantization degeneracies are cleaned during preparation.

## Display behavior

`city-car-navigation.ts` paints the physical navigation screen and cluster. It uses the city street constants and location manifest. The driver arrow stays fixed while the streets and location labels translate and rotate underneath it using the car's actual X/Z position and heading.

During the journey, the highlighted path uses the same sampled road curve as the car. The remaining path, arrival distance and destination update from that curve's actual progress. The instrument panel shows the simulated vehicle speed and drive/reverse/park state. Texture uploads are limited to approximately 11Hz and use the existing render loop and WebGL canvas.

In free roam, **C** cycles chase, close chase and cockpit views; the Settings action offers the same cycle. Cockpit navigation follows keyboard, gamepad or touch-driven movement. The external floating minimap hides while seated inside, and phone controls move down to leave the dashboard visible. The map returns with the chase view. Stepping out returns to the exterior camera.

The interior screen is a mesh attached to the dashboard, with a dark bezel and mount. It remains fully within the desktop and portrait-phone camera frame. The outside model keeps its existing roof, windows and fastback silhouette. The inside view substitutes a padded lining and narrow pillars for the thick exterior window surround. The exterior mannequin is hidden from the driver's-eye view.

## Validation

The production build and TypeScript pass. Both the updated fastback GLB and the cockpit GLB validate after decoding Meshopt with zero errors, warnings or informational issues. Reports and screenshots are under `docs/qa/cockpit/`; exterior validation remains under `docs/qa/fastback/`.

The cockpit browser checks verify that the painted map changes as the actual car advances, its position/heading and remaining distance match the car's route, the screen projects fully into desktop/phone viewports, free-roam movement updates navigation, and the external minimap returns on leaving cockpit view. Existing journey reversal, vehicle handoff, walking/re-entry, touch, settings, waypoint and fallback checks also cover the integration.

Nine focused integration checks passed. After the final framing and parking fixes, both cockpit checks passed again, including heading changes, windshield-marker clearance, phone screen fit and restoration of the parked exterior.
