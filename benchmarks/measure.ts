export interface Measurement {
  name: string;
  runs: number;
  medianMs: number;
  p95Ms: number;
  opsPerSecond: number;
}

const percentile = (sortedValues: number[], ratio: number) => sortedValues[Math.min(sortedValues.length - 1, Math.floor(sortedValues.length * ratio))];

/** Times `run` repeatedly; `operations` is how many logical operations one run performs. */
export const measure = (name: string, run: () => void, { runs = 10, warmup = 2, operations = 1 } = {}): Measurement => {
  Array.from({ length: warmup }).forEach(run);
  const durations = Array.from({ length: runs }, () => {
    const start = performance.now();
    run();
    return performance.now() - start;
  }).sort((a, b) => a - b);
  const medianMs = percentile(durations, 0.5);
  return {
    name,
    runs,
    medianMs: Number(medianMs.toFixed(2)),
    p95Ms: Number(percentile(durations, 0.95).toFixed(2)),
    opsPerSecond: Math.round(operations / (medianMs / 1000)),
  };
};
