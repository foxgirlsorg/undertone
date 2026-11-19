"use client";

/* The blocks of the stats screen. Each one asks one question and owns its own data and states. */

import * as React from "react";
import { CoverArt, Empty, ErrorNote, Link, Panel, SkeletonRows } from "@/components/ui";
import { ListenCard } from "@/components/listen/listen-card";
import { useListFeedback } from "@/lib/feedback";
import { useLB } from "@/lib/use-lb";
import { fmtDateLong, fmtInt, plural } from "@/lib/format";
import { ColumnChart, HBarList, Heatmap, MiniColumns, PREVIOUS, type BarRow, type ColumnDatum, type MiniDatum } from "./charts";
import {
  MONTHS,
  MONTH_SHORT,
  WEEKDAYS,
  WEEKDAY_SHORT,
  WEEKDAY_LONG,
  albumCover,
  albumsOf,
  artistsOf,
  countryName,
  isNotCalculated,
  rangeLabel,
  recordingToListen,
  statsBase,
  tracksOf,
  useTopEntity,
  type Scope,
} from "./use-stats";

/* ---------- shared pieces ---------- */

type Query<T> = { data: T | undefined; error: unknown; mutate: () => unknown };

/** Loading, not-calculated, error and empty states for one block. */
function StatBody<T>({
  q,
  rows = 5,
  loading,
  isEmpty,
  emptyText,
  children,
}: {
  q: Query<T>;
  rows?: number;
  loading?: React.ReactNode;
  isEmpty?: (d: T) => boolean;
  emptyText: string;
  children: (d: T) => React.ReactNode;
}) {
  if (q.error) {
    if (isNotCalculated(q.error)) return <Empty>{"Stats for this period aren't calculated yet."}</Empty>;
    return <ErrorNote error={q.error} onRetry={() => void q.mutate()} />;
  }
  if (q.data === undefined) return loading ?? <SkeletonRows rows={rows} cover={false} pitch={44} />;
  if (isEmpty?.(q.data)) return <Empty>{emptyText}</Empty>;
  return <>{children(q.data)}</>;
}

/** Panel aside: the period in grey, and an optional "View all" link. */
function Aside({ range, viewAll }: { range: UserStatsAPIRange; viewAll?: string }) {
  return (
    <>
      <span>{rangeLabel(range)}</span>
      {viewAll ? (
        <>
          <span aria-hidden>·</span>
          <Link href={viewAll} className="text-ink hover:text-data">
            View all
          </Link>
        </>
      ) : null}
    </>
  );
}

const chartLoading = (h: number) => <div className="skel w-full" style={{ height: h }} />;

/** One row of a 5-item overview list: rank, optional cover, title, subline, meta on the right. */
export function RankRow({
  rank,
  title,
  href,
  sub,
  meta,
  cover,
  showCover,
}: {
  rank: number;
  title: string;
  href?: string;
  sub?: string;
  meta?: string;
  cover?: string;
  showCover?: boolean;
}) {
  return (
    <li className="flex min-h-[52px] items-center gap-3 rounded-[12px] px-2 transition-colors hover:bg-[#161616]">
      <span className="num w-6 flex-none text-right text-[13px] text-ink-3">{rank}</span>
      {showCover ? <CoverArt src={cover} alt={title} size={40} /> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium leading-5">
          {href ? <Link href={href}>{title}</Link> : title}
        </div>
        {sub ? <div className="truncate text-[13px] leading-5 text-ink-2">{sub}</div> : null}
      </div>
      {meta ? <span className="num flex-none text-[12px] text-ink-3">{meta}</span> : null}
    </li>
  );
}

/* ---------- listening activity ---------- */

/** The comparison is the requested period against the one before it (the API returns both). */
const COMPARE: Partial<Record<UserStatsAPIRange, [string, string]>> = {
  this_week: ["This week", "Last week"],
  week: ["Last week", "Week before"],
  this_month: ["This month", "Last month"],
  month: ["Last month", "Month before"],
  this_year: ["This year", "Last year"],
  year: ["Last year", "Year before"],
};

type ActivityRow = UserListeningActivityResponse["payload"]["listening_activity"][number];

const daysInMonthOf = (ts: number) => {
  const d = new Date(ts * 1000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
};

function unitLabel(ts: number, range: UserStatsAPIRange): string {
  const d = new Date(ts * 1000);
  if (range === "week" || range === "this_week") return WEEKDAY_SHORT[(d.getUTCDay() + 6) % 7];
  if (range === "month" || range === "this_month") return String(d.getUTCDate());
  if (range === "all_time") return String(d.getUTCFullYear());
  return MONTH_SHORT[d.getUTCMonth()];
}

function buildActivity(rows: ActivityRow[], range: UserStatsAPIRange) {
  const compare = COMPARE[range];
  let cut = 0;
  if (rows.length && compare) {
    if (range === "week" || range === "this_week") cut = 7;
    else if (range === "year" || range === "this_year") cut = 12;
    else cut = daysInMonthOf(rows[0].from_ts);
  }
  const hasPrev = cut > 0 && rows.length > cut;
  const prev = hasPrev ? rows.slice(0, cut) : undefined;
  const cur = hasPrev ? rows.slice(cut) : rows;
  const n = Math.max(cur.length, prev?.length ?? 0);
  const data: ColumnDatum[] = Array.from({ length: n }, (_, i) => {
    const c = cur[i];
    const p = prev?.[i];
    const ref = c ?? p;
    const title = [
      c ? `${fmtDateLong(c.from_ts)}: ${plural(c.listen_count, "listen")}` : null,
      p ? `${fmtDateLong(p.from_ts)}: ${plural(p.listen_count, "listen")}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      key: String(i),
      label: ref ? unitLabel(ref.from_ts, range) : "",
      value: c?.listen_count ?? 0,
      previous: prev ? (p?.listen_count ?? 0) : undefined,
      title,
    };
  });
  return {
    data,
    total: cur.reduce((s, r) => s + r.listen_count, 0),
    current: compare?.[0] ?? rangeLabel(range),
    previous: hasPrev ? compare?.[1] : undefined,
  };
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden className="inline-block size-2.5 flex-none rounded-[2px]" style={{ background: color }} />
      {label}
    </span>
  );
}

export function ListeningActivityPanel({ user, range, className }: Scope & { className?: string }) {
  const q = useLB(["stats-listening", user ?? "sitewide", range], (api) => api.getUserListeningActivity(user, range));
  const series = React.useMemo(
    () => (q.data ? buildActivity(q.data.payload.listening_activity, range) : null),
    [q.data, range]
  );
  return (
    <Panel
      title="Listening activity"
      className={className}
      aside={
        series ? (
          <>
            <Swatch color="var(--data)" label={series.current} />
            {series.previous ? <Swatch color={PREVIOUS} label={series.previous} /> : null}
          </>
        ) : null
      }
    >
      <StatBody
        q={q}
        loading={chartLoading(220)}
        emptyText="No listens in this period."
        isEmpty={(d) => d.payload.listening_activity.length === 0}
      >
        {() =>
          series ? (
            <>
              <div className="mb-3 flex items-baseline gap-2">
                <span className="num text-[24px] font-medium leading-8">{fmtInt(series.total)}</span>
                <span className="text-[13px] text-ink-3">listens</span>
              </div>
              <ColumnChart data={series.data} label={`Listens, ${series.current}`} height={220} />
            </>
          ) : null
        }
      </StatBody>
    </Panel>
  );
}

/* ---------- top lists (overview) ---------- */

export function TopArtistsPanel({ user, range, className }: Scope & { className?: string }) {
  const q = useTopEntity(user, "artist", range, 0, 5);
  return (
    <Panel
      title="Top artists"
      className={className}
      aside={<Aside range={range} viewAll={`${statsBase(user)}/top-artists?range=${range}`} />}
    >
      <StatBody q={q} emptyText="No artists in this period." isEmpty={(d) => artistsOf(d).length === 0}>
        {(d) => {
          const rows: BarRow[] = artistsOf(d)
            .slice(0, 5)
            .map((a, i) => ({
              key: `${a.artist_mbid ?? a.artist_name}-${i}`,
              rank: i + 1,
              label: a.artist_mbid ? <Link href={`/artist/${a.artist_mbid}`}>{a.artist_name}</Link> : a.artist_name,
              value: a.listen_count,
              valueText: fmtInt(a.listen_count),
            }));
          return <HBarList rows={rows} />;
        }}
      </StatBody>
    </Panel>
  );
}

export function TopAlbumsPanel({ user, range, className }: Scope & { className?: string }) {
  const q = useTopEntity(user, "release-group", range, 0, 5);
  return (
    <Panel
      title="Top albums"
      className={className}
      aside={<Aside range={range} viewAll={`${statsBase(user)}/top-albums?range=${range}`} />}
    >
      <StatBody q={q} emptyText="No albums in this period." isEmpty={(d) => albumsOf(d).length === 0}>
        {(d) => (
          <ul className="flex flex-col">
            {albumsOf(d)
              .slice(0, 5)
              .map((a, i) => (
                <RankRow
                  key={`${a.release_group_mbid ?? a.release_group_name}-${i}`}
                  rank={i + 1}
                  showCover
                  cover={albumCover(a)}
                  title={a.release_group_name}
                  href={a.release_group_mbid ? `/album/${a.release_group_mbid}` : undefined}
                  sub={a.artist_name}
                  meta={`${fmtInt(a.listen_count)} listens`}
                />
              ))}
          </ul>
        )}
      </StatBody>
    </Panel>
  );
}

export function TopTracksPanel({ user, range, className }: Scope & { className?: string }) {
  const q = useTopEntity(user, "recording", range, 0, 5);
  return (
    <Panel
      title="Top tracks"
      className={className}
      aside={<Aside range={range} viewAll={`${statsBase(user)}/top-tracks?range=${range}`} />}
    >
      <StatBody q={q} emptyText="No tracks in this period." isEmpty={(d) => tracksOf(d).length === 0}>
        {(d) => <TracksBody recordings={tracksOf(d).slice(0, 5)} />}
      </StatBody>
    </Panel>
  );
}

function TracksBody({ recordings }: { recordings: RecordingEntity[] }) {
  const listens = React.useMemo(() => recordings.map(recordingToListen), [recordings]);
  const fb = useListFeedback(listens);
  return (
    <div className="flex flex-col">
      {recordings.map((r, i) => (
        <ListenCard
          key={`${r.recording_mbid ?? r.track_name}-${i}`}
          listen={listens[i]}
          context={listens}
          feedback={fb.get(listens[i])}
          rank={i + 1}
          compact
          meta={`${fmtInt(r.listen_count)} listens`}
        />
      ))}
    </div>
  );
}

type RecordingEntity = UserRecordingsResponse["payload"]["recordings"][number];

/* ---------- user only: daily activity and genres by time of day ---------- */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Daily activity arrives in UTC, keyed by weekday name. Returns a 7×24 grid in the viewer's time zone. */
function toLocalGrid(daily: UserDailyActivityResponse["payload"]["daily_activity"], shift: number): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  Object.entries(daily).forEach(([day, hours]) => {
    const d = WEEKDAYS.indexOf(day);
    if (d < 0) return;
    hours.forEach(({ hour, listen_count }) => {
      const idx = (((d * 24 + hour + shift) % 168) + 168) % 168;
      grid[Math.floor(idx / 24)][idx % 24] += listen_count;
    });
  });
  return grid;
}

function utcLabel(offsetMin: number) {
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${pad2(m)}` : ""}`;
}

export function DailyActivityPanel({ user, range, className }: { user: string; range: UserStatsAPIRange; className?: string }) {
  const q = useLB(["stats-daily", user, range], (api) => api.getUserDailyActivity(user, range));
  return (
    <Panel title="When you listen" className={className} aside={<Aside range={range} />}>
      <StatBody
        q={q}
        loading={chartLoading(180)}
        emptyText="No listens in this period."
        isEmpty={(d) => Object.values(d.payload.daily_activity).every((hours) => hours.every((h) => h.listen_count === 0))}
      >
        {(d) => <DailyBody data={d} />}
      </StatBody>
    </Panel>
  );
}

function DailyBody({ data }: { data: UserDailyActivityResponse }) {
  const { grid, tz } = React.useMemo(() => {
    const offsetMin = -new Date().getTimezoneOffset();
    return { grid: toLocalGrid(data.payload.daily_activity, Math.round(offsetMin / 60)), tz: utcLabel(offsetMin) };
  }, [data]);
  const peak = React.useMemo(() => {
    let best: { r: number; c: number; v: number } | null = null;
    grid.forEach((row, r) => row.forEach((v, c) => { if (v > 0 && (!best || v > best.v)) best = { r, c, v }; }));
    return best as { r: number; c: number; v: number } | null;
  }, [grid]);
  return (
    <div className="flex flex-col gap-3">
      {peak ? (
        <p className="text-[14px] text-ink-2">
          Most listening on <span className="font-medium text-white">{WEEKDAY_LONG[peak.r]}s around {pad2(peak.c)}:00</span>
          <span className="text-ink-3"> · {plural(peak.v, "listen")}</span>
        </p>
      ) : null}
      <Heatmap
        label="Listens by weekday and hour"
        grid={grid}
        rowLabels={WEEKDAY_SHORT}
        titleOf={(r, c, v) => `${WEEKDAY_SHORT[r]} ${pad2(c)}:00 · ${plural(v, "listen")}`}
        footnote={`Hours in your time zone (${tz})`}
      />
    </div>
  );
}

const TIME_BUCKETS = [
  { name: "Night", span: "12–6 AM", from: 0, to: 5 },
  { name: "Morning", span: "6 AM–12 PM", from: 6, to: 11 },
  { name: "Afternoon", span: "12–6 PM", from: 12, to: 17 },
  { name: "Evening", span: "6 PM–12 AM", from: 18, to: 23 },
];

export function GenreActivityPanel({ user, range, className }: { user: string; range: UserStatsAPIRange; className?: string }) {
  const q = useLB(["stats-genre", user, range], (api) => api.getUserGenreActivity(user, range));
  return (
    <Panel title="Genres by time of day" className={className} aside={<Aside range={range} />}>
      <StatBody q={q} emptyText="No genres in this period." isEmpty={(d) => d.payload.genre_activity.length === 0}>
        {(d) => <GenreBody data={d} />}
      </StatBody>
    </Panel>
  );
}

function GenreBody({ data }: { data: UserGenreActivityResponse }) {
  const buckets = React.useMemo(() => {
    const shift = Math.round(-new Date().getTimezoneOffset() / 60);
    const totals = TIME_BUCKETS.map(() => new Map<string, number>());
    data.payload.genre_activity.forEach((g) => {
      const h = (((g.hour + shift) % 24) + 24) % 24;
      const bi = TIME_BUCKETS.findIndex((b) => h >= b.from && h <= b.to);
      if (bi < 0) return;
      totals[bi].set(g.genre, (totals[bi].get(g.genre) ?? 0) + g.listen_count);
    });
    return TIME_BUCKETS.map((b, i) => ({
      ...b,
      items: Array.from(totals[i])
        .map(([name, count]) => ({ name, count }))
        .sort((x, y) => y.count - x.count)
        .slice(0, 3),
    }));
  }, [data]);
  return (
    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
      {buckets.map((b) => (
        <div key={b.name}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="font-medium">{b.name}</span>
            <span className="text-ink-3">{b.span}</span>
          </div>
          {b.items.length ? (
            <ol className="mt-1 flex flex-col">
              {b.items.map((g, i) => (
                <li key={g.name} className="flex items-baseline gap-2 py-0.5 text-[14px]">
                  <span className="num w-4 flex-none text-[12px] text-ink-3">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate capitalize">{g.name}</span>
                  <span className="num flex-none text-[13px] text-ink-2">{fmtInt(g.count)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-[13px] text-ink-3">No listens</p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- artist activity and release decades ---------- */

export function ArtistActivityPanel({ user, range, className }: Scope & { className?: string }) {
  const q = useLB(["stats-artist-activity", user ?? "sitewide", range], (api) =>
    api.getUserArtistActivity(user, range)
  );
  return (
    <Panel title="Artist activity" className={className} aside={<Aside range={range} />}>
      <StatBody
        q={q}
        emptyText="No artists in this period."
        isEmpty={(d) => d.payload.artist_activity.length === 0}
      >
        {(d) => {
          const rows: BarRow[] = d.payload.artist_activity.slice(0, 10).map((a, i) => {
            const name = a.name || a.artist_name || "";
            const top = [...(a.albums ?? [])].sort((x, y) => y.listen_count - x.listen_count)[0];
            return {
              key: `${a.artist_mbid ?? name}-${i}`,
              rank: i + 1,
              label: a.artist_mbid ? <Link href={`/artist/${a.artist_mbid}`}>{name}</Link> : name,
              sub: top ? `Top album: ${top.name}` : undefined,
              value: a.listen_count,
              valueText: fmtInt(a.listen_count),
            };
          });
          return <HBarList rows={rows} />;
        }}
      </StatBody>
    </Panel>
  );
}

export function EraPanel({ user, range, className }: Scope & { className?: string }) {
  const q = useLB(["stats-era", user ?? "sitewide", range], (api) => api.getUserEraActivity(user, range));
  return (
    <Panel title="Release decades" className={className} aside={<Aside range={range} />}>
      <StatBody
        q={q}
        loading={chartLoading(200)}
        emptyText="No release years in this period."
        isEmpty={(d) => d.payload.era_activity.length === 0}
      >
        {(d) => <EraBody years={d.payload.era_activity} />}
      </StatBody>
    </Panel>
  );
}

function EraBody({ years }: { years: Array<{ year: number; listen_count?: number; count?: number }> }) {
  const columns = React.useMemo(() => {
    const byDecade = new Map<number, number>();
    years.forEach((y) => {
      const dec = Math.floor(y.year / 10) * 10;
      byDecade.set(dec, (byDecade.get(dec) ?? 0) + (y.listen_count ?? y.count ?? 0));
    });
    if (!byDecade.size) return [] as ColumnDatum[];
    const keys = Array.from(byDecade.keys());
    const min = Math.min(...keys);
    const max = Math.max(...keys);
    const out: ColumnDatum[] = [];
    for (let dec = min; dec <= max; dec += 10) {
      const v = byDecade.get(dec) ?? 0;
      out.push({ key: String(dec), label: `${dec}s`, value: v, title: `${dec}s · ${plural(v, "listen")}` });
    }
    return out;
  }, [years]);
  return <ColumnChart data={columns} label="Listens by release decade" height={200} />;
}

/* ---------- artist evolution (small multiples) ---------- */

const unitRank = (u: string) => {
  const w = WEEKDAYS.indexOf(u);
  if (w >= 0) return w;
  const m = MONTHS.indexOf(u);
  if (m >= 0) return m;
  const n = Number(u);
  return Number.isNaN(n) ? 0 : n;
};

const shortUnit = (u: string) => {
  if (WEEKDAYS.includes(u)) return u.slice(0, 3);
  const m = MONTHS.indexOf(u);
  if (m >= 0) return MONTH_SHORT[m];
  return u;
};

/** Top five artists over the time units of the period, on one shared scale. */
export function evolutionModel(rows: RawUserArtistEvolutionRow[], range: UserStatsAPIRange) {
  const totals = new Map<string, { name: string; mbid: string; total: number }>();
  const values = new Map<string, Map<string, number>>();
  const units = new Set<string>();
  rows.forEach((r) => {
    const key = r.artist_mbid || r.artist_name;
    const t = totals.get(key) ?? { name: r.artist_name, mbid: r.artist_mbid, total: 0 };
    t.total += r.listen_count;
    totals.set(key, t);
    const u = String(r.time_unit);
    units.add(u);
    const m = values.get(key) ?? new Map<string, number>();
    m.set(u, (m.get(u) ?? 0) + r.listen_count);
    values.set(key, m);
  });

  let order = Array.from(units).sort((a, b) => unitRank(a) - unitRank(b));
  if (range === "all_time") {
    // Years with no listens still get a column, so the timeline is honest.
    const nums = order.map(Number);
    if (nums.every((n) => !Number.isNaN(n)) && nums.length) {
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      if (max - min <= 300) {
        order = Array.from({ length: max - min + 1 }, (_, i) => String(min + i));
      }
    }
  }

  const top = Array.from(totals.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);
  const max = Math.max(1, ...top.flatMap(([key]) => order.map((u) => values.get(key)?.get(u) ?? 0)));
  const series = top.map(([key, t]) => ({
    key,
    name: t.name,
    mbid: t.mbid,
    total: t.total,
    points: order.map<MiniDatum>((u) => {
      const v = values.get(key)?.get(u) ?? 0;
      return { key: u, label: shortUnit(u), value: v, title: `${u}: ${plural(v, "listen")}` };
    }),
  }));
  return { series, max };
}

export function EvolutionPanel({ user, range, className }: Scope & { className?: string }) {
  const q = useLB(["stats-evolution", user ?? "sitewide", range], (api) =>
    api.getUserArtistEvolutionActivity(user, range)
  );
  return (
    <Panel title="Artist evolution" className={className} aside={<Aside range={range} />}>
      <StatBody
        q={q}
        loading={chartLoading(220)}
        emptyText="No artist activity in this period."
        isEmpty={(d) => d.payload.artist_evolution_activity.length === 0}
      >
        {(d) => <EvolutionBody rows={d.payload.artist_evolution_activity} range={range} />}
      </StatBody>
    </Panel>
  );
}

function EvolutionBody({ rows, range }: { rows: RawUserArtistEvolutionRow[]; range: UserStatsAPIRange }) {
  const model = React.useMemo(() => evolutionModel(rows, range), [rows, range]);
  return (
    <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-5">
      {model.series.map((s) => (
        <div key={s.key} className="min-w-0">
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[14px]">
            <span className="min-w-0 truncate font-medium">
              {s.mbid ? <Link href={`/artist/${s.mbid}`}>{s.name}</Link> : s.name}
            </span>
            <span className="num flex-none text-[12px] text-ink-3">{fmtInt(s.total)}</span>
          </div>
          <MiniColumns data={s.points} max={model.max} label={`${s.name}, listens over time`} height={80} />
        </div>
      ))}
    </div>
  );
}

/* ---------- artist origins ---------- */

export function ArtistMapPanel({ user, range, className }: Scope & { className?: string }) {
  const q = useLB(["stats-artist-map", user ?? "sitewide", range], (api) => api.getUserArtistMap(user, range));
  return (
    <Panel title="Where your artists are from" className={className} aside={<Aside range={range} />}>
      <StatBody q={q} emptyText="No artist origins in this period." isEmpty={(d) => d.payload.artist_map.length === 0}>
        {(d) => {
          const rows: BarRow[] = [...d.payload.artist_map]
            .sort((a, b) => b.listen_count - a.listen_count)
            .slice(0, 10)
            .map((c, i) => ({
              key: c.country,
              rank: i + 1,
              label: countryName(c.country),
              sub: plural(c.artist_count, "artist"),
              value: c.listen_count,
              valueText: fmtInt(c.listen_count),
            }));
          return <HBarList rows={rows} />;
        }}
      </StatBody>
    </Panel>
  );
}
