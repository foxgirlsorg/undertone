"use client";

/*
  Stats charts. Column charts are Recharts (one hue, var(--data); the previous period in grey).
  HBarList and Heatmap are plain HTML/CSS layouts: a ranked bar list and an hour-by-day grid.
*/

import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtCompact, fmtInt } from "@/lib/format";

/** The comparison (previous period) series: a quiet grey next to the data hue. */
export const PREVIOUS = "#5c5c5c";
const GRID = "#2b2b2b";
const TICK = "#949494";
const CELL_EMPTY = "#1a1a1a";

/** Width of the wrapper, measured after mount. */
export function useElementWidth<T extends HTMLElement>(initial = 600) {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(initial);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setWidth(Math.max(160, Math.floor(el.clientWidth)));
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const fmtTick = (n: number) => (n >= 1000 ? fmtCompact(n) : fmtInt(n));

/** 3–5 round ticks from 0 to just above `max`, on a 1/2/2.5/5 × 10ⁿ step. */
export function niceTicks(max: number): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Dark plain tooltip: no arrow, no shadow, white text. */
const tooltipProps = {
  cursor: { fill: "#ffffff0d" },
  contentStyle: {
    background: "#1a1a1a",
    border: "none",
    borderRadius: 8,
    boxShadow: "none",
    fontSize: 12,
    color: "#fff",
    padding: "6px 10px",
  },
  labelStyle: { color: "#fff", fontWeight: 500, marginBottom: 2 },
  itemStyle: { color: "#fff", padding: 0 },
} as const;

export type ColumnDatum = {
  key: string;
  label: string;
  value: number;
  /** Previous-period value, drawn as a grey column beside the current one. */
  previous?: number;
  title: string;
};

/** Column chart with an optional previous-period series (grey, left of each current column). */
export function ColumnChart({ data, label, height = 200 }: { data: ColumnDatum[]; label: string; height?: number }) {
  const hasPrev = data.some((d) => d.previous !== undefined);
  const ticks = niceTicks(Math.max(0, ...data.map((d) => Math.max(d.value, d.previous ?? 0))));
  return (
    <div role="img" aria-label={label} className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <YAxis
            ticks={ticks}
            domain={[0, ticks[ticks.length - 1]]}
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            width={44}
            tickMargin={8}
            tick={{ fill: TICK, fontSize: 12 }}
            tickFormatter={(v: number) => fmtTick(v)}
          />
          <XAxis
            dataKey="label"
            interval="preserveStartEnd"
            minTickGap={16}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            tick={{ fill: TICK, fontSize: 12 }}
          />
          <Tooltip
            {...tooltipProps}
            labelFormatter={(_, payload) => (payload?.[0]?.payload as ColumnDatum | undefined)?.title ?? ""}
            formatter={(value, name) => [fmtInt(Number(value)), name]}
          />
          {hasPrev ? (
            <Bar
              dataKey="previous"
              name="Previous period"
              fill={PREVIOUS}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
          ) : null}
          <Bar dataKey="value" name="Listens" fill="var(--data)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type BarRow = {
  key: string;
  rank: number;
  label: React.ReactNode;
  sub?: React.ReactNode;
  value: number;
  valueText: string;
};

/** Ranked list where each row has a 2px proportional bar under its label. The top row is the data hue. */
export function HBarList({ rows }: { rows: BarRow[] }) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0) || 1;
  return (
    <ol className="flex flex-col">
      {rows.map((r, i) => (
        <li key={r.key} className="flex items-start gap-3 py-[7px]">
          <span className="num w-5 flex-none pt-px text-right text-[13px] text-ink-3">{r.rank}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[14px] font-medium leading-5">{r.label}</span>
              <span className="num flex-none text-[13px] text-ink-2">{r.valueText}</span>
            </div>
            {r.sub ? <div className="truncate text-[12px] leading-4 text-ink-3">{r.sub}</div> : null}
            <div className="mt-1.5 h-[2px] w-full rounded-full bg-[#1f1f1f]" aria-hidden>
              <div
                className="h-full rounded-full"
                style={{ width: `${(r.value / max) * 100}%`, background: i === 0 ? "var(--data)" : PREVIOUS }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Hour-by-day grid. `grid[row][col]` counts; rows are days, columns are the 24 hours. */
export function Heatmap({
  grid,
  rowLabels,
  titleOf,
  label,
  footnote,
}: {
  grid: number[][];
  rowLabels: string[];
  titleOf: (row: number, col: number, value: number) => string;
  label: string;
  footnote?: React.ReactNode;
}) {
  const max = Math.max(1, ...grid.flat());
  const opacity = [0, 0.22, 0.45, 0.72, 1];
  const level = (v: number) => (v === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((v / max) * 4))));
  // CSS grid: a day-label column plus 24 equal hour columns; cells stay square at every width.
  const cols = "grid-cols-[28px_repeat(24,minmax(0,1fr))] sm:grid-cols-[36px_repeat(24,minmax(0,1fr))]";
  return (
    <div role="img" aria-label={label} className="w-full">
      <div className={`grid ${cols} gap-[2px] sm:gap-[3px]`}>
        <span />
        {/* One label per three hours, spanning its three columns so "00" never overflows a cell. */}
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={`h${i}`}
            className={`num col-span-3 pb-1 text-[11px] leading-none text-ink-3 ${i % 2 === 1 ? "max-sm:invisible" : ""}`}
          >
            {pad2(i * 3)}
          </span>
        ))}
        {rowLabels.map((name, r) => (
          <React.Fragment key={name}>
            <span className="flex items-center text-[11px] leading-none text-ink-3 sm:text-[12px]">{name}</span>
            {Array.from({ length: 24 }, (_, c) => {
              const v = grid[r]?.[c] ?? 0;
              const l = level(v);
              return (
                <span
                  key={c}
                  title={titleOf(r, c, v)}
                  className="aspect-square rounded-[3px]"
                  style={l === 0 ? { background: CELL_EMPTY } : { background: "var(--data)", opacity: opacity[l] }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-ink-3">
        <span className="mr-auto text-[12px]">{footnote}</span>
        <span className="flex items-center gap-1.5">
        <span>Less</span>
        {opacity.map((o, i) => (
          <span
            key={i}
            aria-hidden
            className="size-3 rounded-[3px]"
            style={i === 0 ? { background: CELL_EMPTY } : { background: "var(--data)", opacity: o }}
          />
        ))}
        <span>More</span>
        </span>
      </div>
    </div>
  );
}

export type MiniDatum = { key: string; label: string; value: number; title: string };

/** Small column chart for small multiples. `max` is shared across the group so the scale matches. */
export function MiniColumns({
  data,
  max,
  label,
  height = 72,
}: {
  data: MiniDatum[];
  max: number;
  label: string;
  height?: number;
}) {
  const top = max > 0 ? max : 1;
  return (
    <div role="img" aria-label={label} className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="30%">
          <YAxis hide type="number" domain={[0, top]} />
          <XAxis
            dataKey="label"
            interval="preserveStartEnd"
            minTickGap={12}
            height={26}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            tickMargin={4}
            tick={{ fill: TICK, fontSize: 12 }}
          />
          <Tooltip
            {...tooltipProps}
            labelFormatter={(_, payload) => (payload?.[0]?.payload as MiniDatum | undefined)?.title ?? ""}
            formatter={(value, name) => [fmtInt(Number(value)), name]}
          />
          <Bar dataKey="value" name="Listens" fill="var(--data)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
