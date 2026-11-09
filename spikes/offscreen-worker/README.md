# Spike: OffscreenCanvas worker rendering (#36)

Throwaway experiment, not part of the build or the type-check. Run it with `npm run spike:offscreen`; CI prints the table in the job summary.

## What it does

Draws a 100k-row grid of numbers (column-major `Float64Array`, like `ColumnStore`) at 1280x800, scrolling 40px per frame while writing 1000 random cell updates per frame. The same `drawGrid` runs either:

- **main**: in a `requestAnimationFrame` loop on the main thread, or
- **worker**: in a worker that owns the canvas through `transferControlToOffscreen()`.

Each mode is measured with an idle main thread and with a main thread that is busy half the time (25 ms of every 50 ms), standing in for application work.

## What it shows (local run, Chromium headless)

| mode | busy main thread | fps | frame p95 (ms) | draw mean (ms) |
| --- | --- | ---: | ---: | ---: |
| main | no | 60.3 | 16.8 | 0.90 |
| worker | no | 60.1 | 16.8 | 0.93 |
| main | yes | 60.2 | 31.7 | 0.66 |
| worker | yes | 60.1 | 16.8 | 0.71 |

- Drawing costs the same in both threads. A worker does not make a frame cheaper.
- The gain is isolation: with a busy main thread the main-thread grid drops frames (p95 doubles); the worker keeps its cadence.

## Limits of this spike

- Updates and scrolling are generated inside the thread that draws. A real grid gets scroll position and data from the main thread, so scroll input still waits for a busy main thread, and the data has to cross over (transferred buffers, or a `SharedArrayBuffer`, which needs cross-origin isolation headers).
- Only text cells; no formatting, renderers, flashing, sorting or hit-testing.
- Not measured: latency from input to pixels, memory, fonts in workers (`document.fonts` does not exist there; use `self.fonts`/`FontFace`), Safari/Firefox support.

## What porting the real grid would need

- Renderers and `CellContext` stop touching the DOM: `CanvasRenderer` and `Loading` create `<canvas>` elements, and `Layer` owns one. `OffscreenCanvas` can replace them.
- `CellRenderer.draw` functions are user supplied and would have to be importable in the worker (module URL), not closures from the main thread.
- The data store would live in the worker, or be a view over shared buffers.
