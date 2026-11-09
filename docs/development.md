# Development

Requires Node.js 22.18+; `.nvmrc` pins 24, which CI uses (the Node-side scripts are TypeScript run through Node's native type stripping).

```sh
npm ci
npm run dev          # Vite dev server: the demo's worker feed and controls on your sources, http://localhost:3000
npm run build        # type-check, then bundle (UMD + ESM) and emit declarations into build/
npm test             # type-check, release-script tests and data store unit tests
npm run bench        # data store benchmarks (BENCH_ROWS=1000,1000000 to change sizes)
npm run bench:scroll # scroll FPS and frame-time p95 in headless Chromium (needs `npx playwright install chromium`); SCROLL_GPU=1 rasterises on the GPU
npm run serve-local  # run only the example data server
npm run site         # preview the demo site (site/) on http://localhost:4000
```

`DEV_PORT` (env or `.env`) changes the dev port.

`npm run dev` shows the same simulated market feed as the demo site, with the same controls (rows, updates per second, sort, pause feed). The feed is `site/data-worker.js` running in a web worker, and the formatters, the extra `trend` layer and the sort options come from `site/grid-setup.js`, shared with the demo (`site/demo.js`), so changing either changes both. Unlike the demo, which loads the published package, the dev page imports `components/web-component.ts`, so edits reload immediately.

The demo site in `site/` is plain static files, with no build step. It loads the grid from unpkg and is fed by a web worker (`site/data-worker.js`). `npm run site` serves it locally; open `http://localhost:4000/?local` to run it against your own `npm run build` output instead of the published package. `SITE_PORT` changes the port. The site is deployed to GitHub Pages by `.github/workflows/pages.yml` whenever `site/` changes on `master`.

Releases are published to npm from CI when a `vX.Y.Z` tag is pushed (see `.github/workflows/publish.yml`).

Pull requests also run the scroll benchmark against the base commit in CI (`.github/workflows/benchmark.yml`): base and head alternate five times on the same runner, and the job summary shows the median change. It fails when mean or p95 draw time regresses by more than 15% and 0.2 ms, or when more than 2 extra frames stall (`BENCHMARK_THRESHOLD`, `BENCHMARK_MIN_DIFFERENCE_MS`, `BENCHMARK_STALL_ALLOWANCE`); frame rate and frame times are reported but not gated, since they are capped by the display. Locally: `node scripts/compare-benchmarks.mts <path-to-base-checkout>`.

The benchmark prints the renderer it ran on and the CI summary repeats it. Headless Chromium rasterises in software (SwiftShader) by default, which is what CI measures. `SCROLL_GPU=1 npm run bench:scroll` launches Chromium with ANGLE/OpenGL and GPU rasterisation instead, for local comparisons; results from different renderers are not comparable. The gated draw time is the time spent issuing canvas commands from JavaScript, which does not change much with the renderer (on one machine: 11.3 ms in software, 13.6 ms on an AMD GPU), so it is a stable regression signal but says little about GPU rasterisation cost. Make the scenario heavier with `SCROLL_ROWS`, `SCROLL_COLUMNS` and `SCROLL_STEP`.

The data store benchmark runs in a second CI job (`data-store-benchmark`) the same way, at 20,000 and 100,000 rows (`BENCH_ROWS`; costs that grow with the row count only show at the larger size): five alternating runs of base and head, comparing the median of each benchmark in `benchmarks/data-store.bench.ts` (setRows, updates, removals, empty flushes, sorting, visible-range reads, streaming appends, wide rows, hot cells and a mixed flush). The summary shows each side's median and its fastest–slowest run. A benchmark fails when even head's fastest run is more than 20% and 0.2 ms slower than base's median (`DATA_STORE_THRESHOLD`, `DATA_STORE_MIN_DIFFERENCE_MS`), so one slow run cannot fail it. The heap cases report retained bytes per row after `setRows` (the benchmark runs with `--expose-gc`); they are deterministic, so they fail at +10% and 8 bytes per row (`DATA_STORE_HEAP_THRESHOLD`). Cheap cases run 20 flushes (2000 for empty flushes) per sample to stay above timer noise. Locally: `node scripts/compare-data-store.mts <path-to-base-checkout>`; both checkouts need `npm ci`.

### How the thresholds were chosen

They come from identical-code (A/A) runs, so the gates sit above the noise but not far above it. Over five CI runs where head and base had the same components and three local ones:

- Data store: the gate statistic (head's fastest run against base's median) stayed under 6% for almost every case. The worst were the number-column sort at 20,000 rows (12.8%, 1.1 ms) and the wide-row sort (10.4%). The median-to-median change alone reached +64% for a single case, which is why the gate uses the fastest head run. 20% leaves roughly 1.5x headroom over the worst observed.
- Scroll: the draw-time mean and p95 changed by at most 2.4% across eight A/A runs, but the baseline is now about 2 ms, so timer resolution (0.1 ms) is a few percent on its own. 15% and a 0.2 ms floor cover that.
- Heap per row: identical in every A/A run, so 10% is generous.

Revisit them when the A/A data changes (a new runner type, a much faster baseline). To measure the noise, run `compare-data-store.mts` or `compare-benchmarks.mts` with a base checkout of the same commit.
