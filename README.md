# Canvas Grid

[![CI](https://github.com/Koeroesi86/canvas-grid/actions/workflows/ci.yml/badge.svg)](https://github.com/Koeroesi86/canvas-grid/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@koeroesi86/canvas-grid)](https://www.npmjs.com/package/@koeroesi86/canvas-grid)

A fast data grid rendered on `<canvas>`, shipped as a framework-agnostic custom element (`<canvas-grid>`). It virtualises rows and columns, flashes cells when their values change, and is built for streams of frequent updates.

- Plain web component: no framework required, works with React, Vue, Angular or vanilla JS
- Written in TypeScript, types included
- Optional AG Grid-style adapter (`agApi`) for `setRowData` / `updateRowData` / `setColumnDefs`

Live demo and feature overview: https://koeroesi86.github.io/canvas-grid/

## Documentation

- [Getting started](docs/getting-started.md): install, usage, browser support
- [API reference](docs/api.md): data model, methods, properties
- [Sorting](docs/sorting.md)
- [Custom renderers and layers](docs/renderers.md)
- [AG Grid-style adapter](docs/ag-grid-adapter.md)
- [TypeScript](docs/typescript.md)
- [Development](docs/development.md): scripts, demo site, releases, benchmarks

## Security

See [SECURITY.md](.github/SECURITY.md).

## License

[MIT](LICENSE)
