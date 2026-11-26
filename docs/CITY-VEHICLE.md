# StatOz fastback

The journey and free-roam car now use a coherent classic fastback exterior instead of the old lofted primitive shell. The long hood, wheel cutouts, shaped fenders, fastback cabin, scoop, stripes, bumpers, exhaust tips and separate wheels come from a licensed model. Petrol-blue paint, restrained cyan sill lighting, animated instruments and the right-hand-drive driver keep it in the StatOz city style.

## Source and preparation

- Creator: Grab3D, [Muscle Car](https://grab3d.com/models/vehicles/muscle-car/).
- Source: `https://grab3d.com/dl/muscle-car/muscle-car.glb`.
- CC0 dedication and creator's origin disclosure: `public/assets/city/licenses/Grab3D-Muscle-Car.txt`.
- Source hash, modifications and runtime path: `public/assets/city/manifest.json`, `statoz-fastback` entry.
- The source is an unbranded procedural Blender model. Its creator discloses AI assistance for the generator scripts. It is not an extracted Ford/game asset.
- Preparation: `scripts/prepare-city-car.mjs`. Download the GLB and `LICENSE.txt` into `.cache/car-source/`, then run `node scripts/prepare-city-car.mjs`. Run this after the base city asset preparation if rebuilding all asset manifests.

The script recolors the paint atlas while retaining charcoal stripes and chrome, reduces body maps to 1024px, removes the static source cockpit, and opens the deck beneath the cabin for the first-person camera. It separates the roof, window surround, headlights and taillights; removes zero-area clipping triangles; normalizes interpolated normals; generates MikkTSpace tangents; deduplicates resources; and applies Meshopt compression. The final GLB is approximately 1.64 MB, with eight source material slots and five textures. No external assets are requested at runtime.

## Runtime fit

`city-car-asset.ts` loads the local GLB using the existing Three.js/Meshopt stack. Each vehicle owns its GPU resources. The source glTF faces +Z, so its holder rotates by pi to match the city's -Z vehicle convention. Front and rear wheels retain their hub origins and use their actual .33m/.355m rolling radii. The front pivots steer independently. The source's footprint fits the existing simplified driving collision proxy.

`city-drive-car.ts` retains suspension motion, headlights, trails and the exterior driver. The interior now uses a separate licensed dashboard, steering wheel and upholstery assembly, with live heading-up city navigation and instrument textures. A padded close-view roof lining and narrow pillars replace the exterior display mesh's window surround when seated inside. Interior and exterior asset promises resolve before shader warmup; early disposal cancels attachment and frees late-arriving resources. See [CITY-COCKPIT.md](CITY-COCKPIT.md) for the current interior sources and navigation behavior.

The chase-camera collision query now receives world coordinates before the boom is converted to an offset. The previous ordering tested an unrelated diagonal through the city and pulled the camera into the rear bodywork on a clear road. A regression check covers settled handoff clearance.

## Verification

Production build and TypeScript checks pass. The model is validated both as shipped and after decoding Meshopt; the decoded GLB has zero errors, warnings or informational issues. The shipped file has only the validator's unsupported-Meshopt informational notice. Reports are in `docs/qa/fastback/`.

Desktop (1440x950) and phone (390x844) captures cover the cockpit, rear, side, front and close quarter views. Both journey and roam assets load with all four hub pivots, and the captured pages have no runtime/console errors. The settled open-road chase camera is approximately 12.4m from the car instead of approximately 3m before the collision-coordinate fix.

Six focused browser checks pass: journey/cockpit reversal; driving, walking and re-entry; touch controls; desktop and phone destination markers; and reduced-motion/WebGL fallback. A separate blocked-GLB check confirms the simple view retains all seven chapters and offers Retry 3D. The final lamp pass adds inset luminous lenses ahead of the source's baked grille and restrains idle brake-light bloom.
