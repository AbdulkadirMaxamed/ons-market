/** Runs of consecutive indexes that have a value; a missing value breaks the line. */
export function segments(values: (number | null)[]): number[][] {
  const out: number[][] = [];
  let run: number[] = [];
  values.forEach((v, i) => {
    if (v == null) {
      if (run.length) out.push(run);
      run = [];
    } else run.push(i);
  });
  if (run.length) out.push(run);
  return out;
}

/** A round y-axis step giving at most four gridlines above zero. */
export function niceScale(max: number): { step: number; top: number } {
  const v = Math.max(max, 1);
  const mag = 10 ** Math.floor(Math.log10(v));
  const step = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => v / s <= 4)!;
  return { step, top: Math.ceil(v / step) * step };
}
