# GitHub Pages

Repository: https://github.com/pai45/statoz-next-website

Website: https://pai45.github.io/statoz-next-website/

This repository owns the current city website. It was initialized from the existing local `statoz-website` project. Its earlier source provenance remains in SOURCE.md. The public Pages deployment uses its GitHub URL; it does not configure a custom domain.

## Build and preview

Use Node 22.12 or later. A fresh checkout uses `npm ci` (the design-system tarball is included in `vendor`). `npm run build:pages` produces a static `out` directory, then `npm run check` checks types and `npm run test:pages` tests the exported site under the real repository prefix. `npm run preview:pages` serves the export at http://127.0.0.1:4411/statoz-next-website/.

The Pages build sets `GITHUB_PAGES=true`, `NEXT_PUBLIC_BASE_PATH=/statoz-next-website`, and `NEXT_PUBLIC_SITE_URL=https://pai45.github.io/statoz-next-website`. Public assets use the vendored design-system `publicAsset` helper. Next Link applies the configured base path itself. CSS assets use relative imports so Next bundles their URLs with the correct prefix. Query-dependent document chrome is resolved on the client; the document contents remain statically rendered. The local `npm run dev` and `npm run build` commands retain the root-path server build.

## Publish

Publication requires an explicit user request. Push the reviewed source to `main`; `.github/workflows/pages.yml` builds the export on Node 22, checks TypeScript, runs the Pages browser suite, uploads the static artifact, and deploys with GitHub's Pages action. It can also be dispatched manually. Build failure blocks deployment.

Check the run for the pushed SHA and the deployed `/version.json` before claiming a release. Its `commit` must match the pushed commit. The deployment browser suite can also run against the public site:

```powershell
$env:CITY_TEST_URL = 'https://pai45.github.io/statoz-next-website/'
$env:EXPECTED_COMMIT = '<published SHA>'
npm.cmd run test:pages
```

The suite checks secondary routes, canonical metadata, manifest icons, query-based chrome, legacy redirects, full 3D assets at desktop and mobile sizes, pause controls, city links, and browser/network errors. On CI the runner renders WebGL on the CPU, so the suite uses a 0.5 device scale factor with the same 1440px and 390px CSS viewports. The desktop city test has six minutes. The other tests have three minutes each. Failed browser runs upload screenshots and traces for diagnosis. Build output, dependency caches, and local test output are ignored by Git.

Analytics remains opt-in through `NEXT_PUBLIC_ENABLE_ANALYTICS=true`; this Pages workflow leaves it off.
