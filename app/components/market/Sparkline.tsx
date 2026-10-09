import { useId } from "react";

import { segments } from "./chartMath";

/** Hero sparkline (7F): draws from start to end, then the end dot appears. Gaps are hatched, never zero. */
export function Sparkline({ values }: { values: (number | null)[] }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const W = 300,
    H = 90,
    p = 6,
    n = values.length;
  const known = values.filter((v): v is number => v != null);
  if (known.length === 0 || n < 2) return null;
  const max = Math.max(...known, 1) * 1.08;
  const x = (i: number) => p + (i * (W - 2 * p)) / (n - 1);
  const y = (v: number) => H - p - (v / max) * (H - 2 * p);
  let last = n - 1;
  while (values[last] == null) last--;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" aria-hidden="true">
      <defs>
        <pattern id={`h${uid}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--missing)" strokeWidth="1.6" opacity=".6" />
        </pattern>
        <clipPath id={`c${uid}`}>
          <rect className="draw-clip" x="0" y="-10" width={W} height={H + 20} />
        </clipPath>
      </defs>
      {values.map((v, i) =>
        v == null ? <rect key={i} x={x(i) - 5} y={p} width="10" height={H - 2 * p} fill={`url(#h${uid})`} /> : null,
      )}
      <g clipPath={`url(#c${uid})`}>
        {segments(values).map((sg) => {
          if (sg.length === 1) return <circle key={sg[0]} cx={x(sg[0])} cy={y(values[sg[0]]!)} r="2.5" fill="var(--line)" />;
          const d = sg.map((i, k) => `${k ? "L" : "M"}${x(i).toFixed(1)} ${y(values[i]!).toFixed(1)}`).join(" ");
          return (
            <g key={sg[0]}>
              <path d={`${d} L${x(sg[sg.length - 1])} ${H - p} L${x(sg[0])} ${H - p}Z`} fill="var(--fill)" />
              <path d={d} fill="none" stroke="var(--line)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
      </g>
      <circle className="draw-dot" cx={x(last)} cy={y(values[last]!)} r="5" fill="var(--line)" stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}
