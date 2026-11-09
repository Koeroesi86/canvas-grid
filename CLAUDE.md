# Canvas Grid

`<canvas-grid>` custom element: a virtualised data grid drawn on stacked canvases, built for high-frequency updates. Published as `@koeroesi86/canvas-grid`. Overview in [README.md](README.md).

## Docs

Read the relevant doc instead of guessing; update it when behaviour changes.

- [docs/getting-started.md](docs/getting-started.md): install and usage
- [docs/api.md](docs/api.md): data model, methods, properties
- [docs/sorting.md](docs/sorting.md): sort model semantics
- [docs/renderers.md](docs/renderers.md): renderer objects, `CellContext`, layers
- [docs/ag-grid-adapter.md](docs/ag-grid-adapter.md): `agApi`
- [docs/typescript.md](docs/typescript.md): exported types
- [docs/development.md](docs/development.md): scripts, demo site, releases, CI benchmark

## Layout

- `components/`: the grid. Entry is `web-component.ts`; `types.ts` holds public types; renderers live in `cell-background/`, `cell-value/`, `header/`; shared helpers in `utils/`
- `benchmarks/`: data store (vitest bench) and Playwright scroll benchmarks
- `scripts/`: release and benchmark-comparison scripts (TypeScript run by Node type stripping, tests are `*.test.mts`)
- `site/`: static GitHub Pages demo, no build step; its worker feed (`data-worker.js`) and `grid-setup.js` are also used by `npm run dev` (`index.html`, `components/example.ts`)
- `build/`: generated, do not edit

## Commands

- `npm test`: type-check, script tests (`node --test`) and vitest unit tests
- `npm run build`: type-check, Vite bundle (UMD + ESM), declarations
- `npm run bench` / `npm run bench:scroll`: performance checks
- Node 22.18+ required

## Working efficiently

- Node comes from `.nvmrc` (24, as in CI); the SessionStart hook in `.claude/hooks/node-env.sh` puts it on PATH, so don't prefix commands with nvm or `export PATH`. If `node` is still missing, use `$HOME/.nvm/versions/node/v24*/bin`.
- Edit `package.json` with `npm pkg set` / `npm pkg delete`, not ad-hoc scripts.
- Compare a change against `master` with `node scripts/compare-benchmarks.mts <base-checkout>` (scroll) or `node scripts/compare-data-store.mts <base-checkout>` (data store); see [docs/development.md](docs/development.md). Playwright needs `npx playwright install chromium` once.
- Wait for CI with `gh pr checks --watch`, not sleep loops. Keep screenshots and scratch files in the scratchpad, not the repo, and keep command output short (`| tail`).
- Use one session per PR or issue; long sessions get compacted and cost more.

## Conventions

- Performance is the product. Draw only the visible range, avoid per-cell allocations on the draw path (`CellContext` is one reused object), draw on request rather than polling, and keep the data store O(1) per update. Run the benchmarks for changes on these paths; CI fails PRs that regress scroll draw time or stalls (scroll benchmark) or data-store timings by more than 30% (data-store benchmark).
- Values are stored by column and formatted lazily; sorting works on raw values, not formatted ones.
- The public API is documented in `docs/`; keep types in `components/types.ts` and docs in sync.
- Add unit tests for data-store and script changes.
- Commits reference the PR/issue number, e.g. `Add X (#NN)`. Work happens on branches off `master`.
- Releases are tag-driven (`vX.Y.Z`) via CI; don't publish by hand.
