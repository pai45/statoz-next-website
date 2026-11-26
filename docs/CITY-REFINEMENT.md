# City visual refinement · 16 November 2026

This revision keeps StatOz's night city, neon sports colours, chamfered interface and existing journey. Kode Sports Club is a reference for the density of authored spaces, coherent environmental storytelling and background activity. No Kode artwork, models, code, branding or content is included.

## What changed

- The skyline now has stepped towers, recessed upper floors, balconies, facade fins, roof parapets, condenser banks and two enclosed illuminated skywalks.
- The high street has rooftop services, turning fans, ladders, covered terraces, tables, seats, cups and street guide kiosks. A three-car elevated tram crosses behind the grounds; courier drones use routes above the service lanes. Roof vents release soft steam and the park fountain has moving water.
- Broadleaf crowns and conifers give the greenery several silhouettes. A subtle vertex wind uses the activity clock.
- Thirteen close citizens and basketball players on desktop, or six basketball players on mobile, use actual rigged male/female character bases from Vibe Basketball. Their outfits, walking and shooting poses are authored for this city. Other citizens remain instanced, with collars, caps/eyewear and backpacks. The existing crowd count varies with the occupied seats.
- Formula's original car geometry replaces the racing placeholders. Vibe Basketball's refined LOD1 contest racks and pedestal furnish the court. A Penalty Shootout fabric normal adds small-scale cloth detail. Local cover art from all fifteen enabled games appears on in-world gallery screens and a changing arcade display.
- Poly Haven's scanned Asphalt 02 diffuse, normal and roughness maps add physical surface detail. Less grain and colour fringing, and slightly stronger environment fill, make the architecture easier to read.

## Asset provenance and reproducibility

Since 2026-11-21 the Quaternius athletes, the athlete fabric and the Formula car are no longer used: people and cars are the Kenney kits (see [CITY.md](CITY.md)), and the refinement manifest lists the five remaining assets. At the time of the original refinement, the added runtime asset bundle was 1,162,930 bytes (about 1.16 MB), with exact sizes and SHA-256 hashes recorded in [the refinement manifest](../public/assets/city/refinement/manifest.json). The original [city-kit manifest](../public/assets/city/manifest.json) is unchanged. Original game source folders are read only during export; their sources and runtime builds are not modified.

Run `node scripts/prepare-city-refinement.mjs` from this project to rebuild. It reads the sibling `statoz-games` workspace and the existing local catalogue covers. The first material acquisition needs network access; later runs reuse `.cache/*-source.jpg` and `.cache/polyhaven-asphalt.json`. Source MD5 values from the official Poly Haven API are verified before conversion; source and output SHA-256 hashes are recorded. Character bind coordinates are preserved in UV0 before glTF quantization so runtime garment placement remains stable. Character materials are identified by mesh name because deduplication can merge otherwise identical materials.

| Source | Decision |
| --- | --- |
| [Kode Sports Club](https://www.kodeclubs.com/) and [the creator's case study](https://gang.tv/works/blue-ribbon-kode-club) | Visual quality and atmosphere reference only. The case-study scene image was reviewed locally; it is not served by this site. |
| [Poly Haven Asphalt 02](https://polyhaven.com/a/asphalt_02), [license](https://polyhaven.com/license) | Imported three CC0 maps, reduced to 512px WebP. Runtime requests stay local. |
| [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) | Reused existing Vibe Basketball game exports; the source archive's CC0 license is copied alongside the models. Simplified into city LODs. |
| [Kenney City Kit Industrial](https://kenney.nl/assets/city-kit-industrial) | Verified CC0 candidate for further industrial districts. Not shipped in this revision; the new rooftop services are original geometry that fits the existing plots. |
| [Quaternius Cyberpunk Game Kit](https://quaternius.com/packs/cyberpunkgamekit.html) | Verified CC0 pack candidate. Not imported; the weapons/platforming kit is less relevant to this sports city than its existing city kits. |
| [MakeHuman on GitHub: asset license](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.ASSETS.md), Hoop Legacy's pinned source manifest | Audited as an option for detailed citizens. Hoop Legacy's MakeHuman-derived modular rigs need its full fitting/skin toolchain; this revision uses the smaller Vibe Basketball rigs and Hoop Legacy cover art. No MakeHuman program code is included. |
| [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) | Reviewed as a GitHub source of PBR and animation examples; model licenses vary and no sample models are shipped. |

The fifteen game names and original cover sources remain in `src/features/home/city-journey-config.ts`; the export combines them into a single local atlas. This adds no claims of live scores, synchronised progress or in-site gameplay.

## Architecture and validation

`city-refinement.ts` authors the extra environment, transit and effects. Static geometry joins the existing material batches, and rigid moving assemblies merge once. `city-game-assets.ts` loads optional local exports, outfits the articulated characters and animates the gallery atlas. It uses the existing Meshopt loader and one KTX2 worker. Source assets, uniforms, shaders, geometry and textures use the world lifecycle; no canvas, animation loop or transcoder worker is added.

All ambient motion, wind, water and game characters use the existing elapsed activity clock. Pause/resume freezes and resumes the actual objects. Reduced-motion visitors retain Simple view. Mobile uses fewer detailed characters, one drone and fewer water/steam particles. Adaptive quality removes extra drones and steam.

Validation commands: `npm run check`, `npm run build`, and `CITY_TEST_PORT=4411 npm test -- --grep "journey layout and accessibility|city dynamics|refinement assets|grounds retain|city activity|one canvas|guide and legacy|retained pages|landscape|story and directory|place links open cold"`. The final targeted production run passed all 15 checks in 1.2 minutes, including axe at 375, 768, 1024 and 1440px, actual pause/resume, context loss, keyboard navigation, no-JavaScript fallback, retained routes, landmark dialogs and every asset hash. This is a targeted suite, not a claim that every older cinematic test was run. The legacy chapter helper now interrupts pending wheel inertia before its programmatic jump, and assertions use the existing seven-chapter copy.

The audit also exposed double-faded mission controls. Controls now reach full opacity by the point at which their chapter becomes interactive; option labels and indices use explicit semantic text tokens. Heading choreography is retained.

`node scripts/inspect-city-refinement.mjs` captures the overview, all sports venues and phone overview, collects console errors, and records the road audit. Production capture uses `CITY_TEST_URL=http://127.0.0.1:4411/`. `scripts/capture-journey.mjs` refreshes all seven chapter posters, the Simple view posters and social image from the actual refined city.

Evidence: [before](qa/refinement-before/results.json), [after](qa/refinement/results.json), [desktop view](qa/refinement/city-1440.png), [phone view](qa/refinement/city-390.png), [basketball](qa/refinement/basketball.png), [football](qa/refinement/football.png), [racing](qa/refinement/racing.png). Desktop/phone-width performance uses a local laptop GPU; it is not a physical-phone measurement. No production publication is part of this revision.

Final production captures reported 75 fps at both 1440px and an emulated 390px viewport, no page/console errors, all enhancement assets loaded, and a clear road/footprint audit. Desktop rendered 780,245 triangles across its full multipass frame; mobile rendered 493,176. The final four asset, animation/pause and context-loss checks also passed after explicit skinned-skeleton cleanup was added. Physical-phone and iOS Safari verification remain outstanding before a public release.
