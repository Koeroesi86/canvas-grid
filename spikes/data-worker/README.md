# Spike: data store in a worker (#36)

Throwaway experiment, not part of the build or the type-check. Run it with `npm run spike:data-worker` (`SPIKE_ROWS` changes the size); CI prints the table in the job summary. It complements [the OffscreenCanvas spike](../offscreen-worker/README.md), which covered drawing.

## What it does

Runs the real `DataStore` (100k rows x 5 columns by default) on the main thread and in a worker, for the operations that block today: loading, a 1000-cell update flush, sorting a number and a text column, and reading a viewport window. For each it records:

- **main thread blocked**: time the main thread ran code for the operation (the compute itself, or posting the request and handling the reply),
- **request to result**: latency until the result is usable on the main thread,
- **longest frame**: the longest gap between animation frames while it ran, i.e. the stall a user would see.

Loading is measured three ways: on the main thread, rows cloned to the worker with `postMessage`, and data that arrives in the worker already (a WebSocket opened in the worker). Sorting returns the new row order as a transferred `Uint32Array` of slots.

## Reading the results

See the table in the PR; the numbers are from CI and vary between runners. The questions it answers:

- Which operations are long enough to be worth moving (loading and sorting, not a 1000-cell flush or a window read)?
- Is cloning rows to a worker affordable, or must the feed be consumed in the worker?
- What does the worker cost in latency?

## Limits

- Values read back for drawing are fetched by window with a round trip; a real design would either draw in the worker too, or keep a copy of the visible window on the main thread.
- Only primitive cell values: a `valueFormatter` or a sort `compare` function cannot be sent to a worker, so they would have to be importable by URL.
- The worker is created in the page; no `SharedArrayBuffer`, so no zero-copy numeric columns (those would need cross-origin isolation).
- Sort is the current implementation; issue #79 (re-sorting only what changed) would change both columns of the table.
