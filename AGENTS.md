# StatOz website
Independent website at port 4410. Repository: pai45/statoz-next-website. Use npm run dev, npm run check, npm run build, npm test. GitHub Pages: npm run build:pages and npm run test:pages; see docs/DEPLOYMENT.md.
Source provenance: docs/SOURCE.md. Never write to the original Desktop website folders.
Homepage compositions live in src/features/home. Keep CSS scoped and consume vendored design-system tokens. Preserve secondary routes and layouts.
This is an explorable cyberpunk city introducing the products, not a live scores dashboard. Sports opens web.statoz.in and Games opens games.statoz.in. Keep product/preview claims factual and identify current store app downloads separately. Never invent ratings, user counts, live data or cross-product progress.
City locations have one manifest in src/features/home/city-config.ts. Free asset provenance is in public/assets/city/manifest.json; rebuilding and camera ownership are documented in docs/CITY.md. Keep rendering on one canvas and bound texture-transcoder workers.
Push, publish or change production only when explicitly requested.
An authorized push to main runs .github/workflows/pages.yml and publishes GitHub Pages after the export and browser checks pass. Verify the exact commit in version.json at the public URL. Preserve the repository base path in public assets, native links, metadata, and city history navigation.
