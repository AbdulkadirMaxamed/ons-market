import { useId, useLayoutEffect, useRef, useState } from "react";

import { fmt, periodLabel } from "~/lib/format";
import { missingFor } from "~/lib/missing";
import type { Notice } from "~/lib/types";
import { niceScale, segments } from "./chartMath";

type Props = {
  periods: string[];
  values: (number | null)[];
  avg: number | null;
  unit: "month" | "quarter";
  notices: Notice[];
};

const NARROW = 560; // phones get a shorter chart

/**
 * Main chart (5A + 6A/6D): line and soft area, dashed 5-year average, hatched columns where ONS has no figure,
 * and a callout giving ONS's reason for the most recent gap. Hover, tap or use the arrow keys to read values.
 */
export function Chart({ periods, values, avg, unit, notices }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720); // server guess; replaced by the real width before the chart is shown
  const [measured, setMeasured] = useState(false);
  const [at, setAt] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = (w: number) => {
      setW(Math.max(280, Math.floor(w)));
      setMeasured(true);
    };
    fit(el.clientWidth);
    const ro = new ResizeObserver(([e]) => fit(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const N = values.length;
  const H = W < NARROW ? 230 : 300;
  const pl = 46,
    pr = 16,
    pt = 18,
    pb = 30,
    iw = W - pl - pr,
    ih = H - pt - pb;
  const known = values.filter((v): v is number => v != null);
  const { step, top } = niceScale(Math.max(...known, avg ?? 0, 1) * 1.08);
  const x = (i: number) => pl + (N === 1 ? iw / 2 : (i * iw) / (N - 1));
  const y = (v: number) => pt + ih - (v / top) * ih;
  const cw = Math.max(6, (iw / Math.max(1, N - 1)) * 0.8);

  let last = N - 1;
  while (last > 0 && values[last] == null) last--;
  const gap = values.lastIndexOf(null);
  const gapWhy = gap >= 0 ? missingFor(periods[gap], notices) : null;

  // x-axis: one label per year where there's room, otherwise a handful of periods
  const years = periods.map((p, i) => ({ p, i })).filter(({ p }) => p.endsWith("-01") || p.endsWith("-Q1"));
  const every = Math.ceil(years.length / Math.max(1, Math.floor(iw / 64)));
  const ticks =
    years.length >= 2
      ? years.filter((_, k) => k % every === 0).map(({ p, i }) => ({ i, t: p.slice(0, 4) }))
      : periods
          .map((p, i) => ({ i, t: periodLabel(p, "short") }))
          .filter((_, k, a) => a.length <= 6 || k % Math.ceil(a.length / 5) === 0);

  const gridlines: number[] = [];
  for (let t = 0; t <= top + 1e-9; t += step) gridlines.push(t);

  const label = `Chart of new online job adverts per ${unit} from ${periodLabel(periods[0])} to ${periodLabel(
    periods[N - 1],
  )}. Latest ${fmt(values[last])}. Use the left and right arrow keys to read each value.`;

  const move = (i: number) => setAt(Math.max(0, Math.min(N - 1, i)));

  // Callout under the chart, its arrow pointing up at the most recent gap (6D, collage 9C). Positioned in % of the
  // chart's width so it's right before the browser has measured anything.
  const gapPct = gap >= 0 ? (x(gap) / W) * 100 : 0;

  return (
    <div ref={box} className="relative" data-chart={measured ? "ready" : "pending"}>
      <svg
        key={`${periods[0]}-${N}`}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={label}
        tabIndex={0}
        className={`block h-auto w-full touch-pan-y focus-visible:rounded-lg ${measured ? "" : "invisible"}`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          move(Math.round(((((e.clientX - r.left) / r.width) * W - pl) / iw) * (N - 1)));
        }}
        onPointerLeave={() => setAt(null)}
        onBlur={() => setAt(null)}
        onFocus={() => setAt(last)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") (move((at ?? last) - 1), e.preventDefault());
          if (e.key === "ArrowRight") (move((at ?? last) + 1), e.preventDefault());
        }}
      >
        <defs>
          <pattern id={`h${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--surface)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--missing)" strokeWidth="2" opacity=".55" />
          </pattern>
          <clipPath id={`c${uid}`}>
            <rect className="draw-clip" x={pl - 6} y="0" width={W - pl + 6} height={H} />
          </clipPath>
        </defs>
        {gridlines.map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--rule)" />
            <text x={pl - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--ink-3)">
              {fmt(t)}
            </text>
          </g>
        ))}
        {values.map((v, i) =>
          v == null ? <rect key={i} x={x(i) - cw / 2} y={pt} width={cw} height={ih} fill={`url(#h${uid})`} /> : null,
        )}
        {ticks.map(({ i, t }) => (
          <text key={i} x={x(i)} y={H - 9} textAnchor="middle" fontSize="12" fill="var(--ink-3)">
            {t}
          </text>
        ))}
        {avg != null && (
          <g>
            <line x1={pl} x2={W - pr} y1={y(avg)} y2={y(avg)} stroke="var(--ink-3)" strokeWidth="1.4" strokeDasharray="5 4" />
            <text x={pl + 6} y={y(avg) - 6} fontSize="12" fill="var(--ink-2)">
              5-year average {fmt(avg)}
            </text>
          </g>
        )}
        <g clipPath={`url(#c${uid})`}>
          {segments(values).map((sg) => {
            if (sg.length === 1) return <circle key={sg[0]} cx={x(sg[0])} cy={y(values[sg[0]]!)} r="3.5" fill="var(--line)" />;
            const d = sg.map((i, k) => `${k ? "L" : "M"}${x(i).toFixed(1)} ${y(values[i]!).toFixed(1)}`).join(" ");
            return (
              <g key={sg[0]}>
                <path d={`${d} L${x(sg[sg.length - 1])} ${y(0)} L${x(sg[0])} ${y(0)}Z`} fill="var(--fill)" />
                <path d={d} fill="none" stroke="var(--line)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              </g>
            );
          })}
          {values[last] != null && (
            <circle cx={x(last)} cy={y(values[last]!)} r="5.5" fill="var(--line)" stroke="var(--surface)" strokeWidth="2.5" />
          )}
        </g>
        {at != null && <line x1={x(at)} x2={x(at)} y1={pt} y2={pt + ih} stroke="var(--ink-2)" />}
      </svg>

      {at != null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-[115%] rounded-md bg-ink px-2.5 py-1.5 text-[13px] whitespace-nowrap text-bg"
          style={{
            left: Math.min(Math.max(x(at), 90), W - 90),
            top: (values[at] == null ? pt + ih / 2 : y(values[at]!)) + 14,
          }}
          aria-live="polite"
        >
          {periodLabel(periods[at])} ·{" "}
          {values[at] == null ? missingFor(periods[at], notices).label : `${fmt(values[at])} adverts`}
        </div>
      )}

      {gapWhy && (
        <div className="relative mt-2.5">
          <span
            aria-hidden="true"
            className="absolute -top-1.5 size-3 -translate-x-1/2 rotate-45 bg-callout"
            style={{ left: `${gapPct}%` }}
          />
          <div
            className="relative rounded-lg bg-callout px-3 py-2 text-[12.5px] leading-[1.4] text-callout-ink"
            style={{
              width: "min(300px, calc(100% - 16px))",
              marginLeft: `clamp(8px, calc(${gapPct}% - 36px), calc(100% - min(300px, calc(100% - 16px)) - 8px))`,
            }}
          >
            <b className="font-semibold">
              {periodLabel(periods[gap])} · {gapWhy.label}
            </b>
            <br />
            {gapWhy.reason}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 px-3 pt-2 pb-1 text-[13px] text-ink-3">
        {gap >= 0 && gapWhy && (
          <span>
            <i className="swatch-missing mr-1.5 inline-block h-3 w-[18px] rounded-sm align-[-1px]" />
            No figure from ONS
          </span>
        )}
        {avg != null && (
          <span>
            <i className="mr-1.5 inline-block w-[18px] border-t-2 border-dashed border-ink-3 align-[4px]" />
            5-year average
          </span>
        )}
      </div>
    </div>
  );
}
