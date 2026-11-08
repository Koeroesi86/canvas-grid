# Development

Requires Node.js 22.18+ (the Node-side scripts are TypeScript run through Node's native type stripping).

```sh
npm ci
npm run dev          # Vite dev server with a random-data websocket source, http://localhost:3000
npm run build        # type-check, then bundle (UMD + ESM) and emit declarations into build/
npm test             # type-check, release-script tests and data store unit tests
npm run bench        # data store benchmarks (BENCH_ROWS=1000,1000000 to change sizes)
npm run bench:scroll # scroll FPS and frame-time p95 in headless Chromium (needs `npx playwright install chromium`)
npm run serve-local  # run only the example data server
npm run site         # preview the demo site (site/) on http://localhost:4000
```

`DEV_PORT` (env or `.env`) changes the dev port.

The demo site in `site/` is plain static files, with no build step. It loads the grid from unpkg and is fed by a web worker (`site/data-worker.js`). `npm run site` serves it locally; open `http://localhost:4000/?local` to run it against your own `npm run build` output instead of the published package. `SITE_PORT` changes the port. The site is deployed to GitHub Pages by `.github/workflows/pages.yml` whenever `site/` changes on `master`.

Releases are published to npm from CI when a `vX.Y.Z` tag is pushed (see `.github/workflows/publish.yml`).

Pull requests also run the scroll benchmark against the base commit in CI (`.github/workflows/benchmark.yml`): base and head alternate three times on the same runner, and the job summary shows the median change. It fails on a regression of more than 30% in FPS or p95 frame time. Locally: `node scripts/compare-benchmarks.mts <path-to-base-checkout>`.
