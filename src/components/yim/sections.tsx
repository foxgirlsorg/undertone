"use client";

/* Sections of a Year in Music report. Each one renders only from data it is given. */

import * as React from "react";
import { Button, toast } from "@heroui/react";
import { ListenCard } from "@/components/listen/listen-card";
import { ColumnChart, type ColumnDatum } from "@/components/stats/charts";
import { usePlayer } from "@/components/player/player-context";
import { Empty, Kpi, KpiStrip, Link, Panel, UserLink, cx } from "@/components/ui";
import { useListFeedback } from "@/lib/feedback";
import { listenKey } from "@/lib/listen";
import { fmtDateLong, fmtHours, fmtInt, plural } from "@/lib/format";
import type { YimAlbum, YimArtist, YimDay, YimPlaylist, YimReport, YimTrack } from "./data";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/* ---------- layout ---------- */

const SPAN: Record<number, string> = {
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  6: "lg:col-span-6",
};

/** A row of panels on the 6-column grid (14px gap). A lone panel takes the full row. */
export function Row({ spans, children }: { spans: [number, number]; children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  return (
    <div className="grid min-w-0 gap-[14px] lg:grid-cols-6">
      {items.map((child, i) => (
        <div key={i} className={cx("min-w-0", items.length === 1 ? SPAN[6] : SPAN[spans[i]])}>
          {child}
        </div>
      ))}
    </div>
  );
}

/** Thin bar on the data hue, relative to the largest value. */
function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
      <div className="h-full rounded-full bg-data" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ---------- totals ---------- */

export function YimKpis({ report }: { report: YimReport }) {
  return (
    <KpiStrip>
      <Kpi label="Total listens" value={fmtInt(report.listens)} />
      <Kpi label="New artists discovered" value={fmtInt(report.newArtists)} />
      <Kpi label="Listening time" value={fmtHours(report.listeningSeconds != null ? report.listeningSeconds * 1000 : null)} />
    </KpiStrip>
  );
}

/* ---------- top artists and genres ---------- */

export function TopArtists({ items }: { items: YimArtist[] }) {
  const max = Math.max(...items.map((a) => a.count), 0);
  return (
    <Panel title="Top artists">
      <ol className="flex flex-col gap-3">
        {items.map((a, i) => (
          <li key={a.key} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <span className="num text-right text-[13px] text-ink-3">{i + 1}</span>
            <span className="min-w-0 truncate text-[14px]">
              {a.mbid ? (
                <Link href={`/artist/${a.mbid}`} className="hover:text-data">
                  {a.name}
                </Link>
              ) : (
                a.name
              )}
            </span>
            <span className="num text-[13px] text-ink-2">{fmtInt(a.count)}</span>
            <span />
            <div className="col-span-2">
              <Bar value={a.count} max={max} />
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function TopGenres({ items }: { items: Array<{ name: string; percent: number }> }) {
  const max = Math.max(...items.map((g) => g.percent), 0);
  return (
    <Panel title="Genres" aside="Share of listens">
      <ol className="flex flex-col gap-3">
        {items.map((g, i) => (
          <li key={g.name} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <span className="num text-right text-[13px] text-ink-3">{i + 1}</span>
            <span className="min-w-0 truncate text-[14px] capitalize">{g.name}</span>
            <span className="num text-[13px] text-ink-2">{g.percent.toFixed(1)}%</span>
            <span />
            <div className="col-span-2">
              <Bar value={g.percent} max={max} />
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/* ---------- albums ---------- */

function AlbumTile({ album }: { album: YimAlbum }) {
  // Remember which URL failed, so a new cover is tried again without an effect.
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const failed = failedSrc !== null && failedSrc === album.cover;
  const body = (
    <>
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-[8px] bg-raised text-[16px] font-medium text-ink-3">
        {album.cover && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={album.cover}
            alt=""
            loading="lazy"
            onError={() => setFailedSrc(album.cover ?? null)}
            className="size-full object-cover"
          />
        ) : (
          (album.title.slice(0, 1) || "—").toUpperCase()
        )}
      </div>
      <div className="mt-2 truncate text-[13px] font-medium">{album.title}</div>
      <div className="num truncate text-[12px] text-ink-3">
        {album.artist} · {plural(album.count, "listen")}
      </div>
    </>
  );
  return (
    <li className="min-w-0">
      {album.href ? (
        <Link href={album.href} className="block hover:text-data">
          {body}
        </Link>
      ) : (
        <div>{body}</div>
      )}
    </li>
  );
}

export function TopAlbums({ items }: { items: YimAlbum[] }) {
  return (
    <Panel title="Top albums">
      <ul className="grid grid-cols-2 gap-[14px] sm:grid-cols-5">
        {items.slice(0, 10).map((a, i) => (
          <AlbumTile key={`${a.key}-${i}`} album={a} />
        ))}
      </ul>
    </Panel>
  );
}

/* ---------- tracks ---------- */

export function TopTracks({ items }: { items: YimTrack[] }) {
  const player = usePlayer();
  const listens = items.map((t) => t.listen);
  const fb = useListFeedback(listens);
  return (
    <Panel
      title="Top tracks"
      aside={
        <Button size="sm" variant="secondary" onPress={() => player.playQueue(listens, 0)}>
          Play all
        </Button>
      }
    >
      <ul className="flex flex-col">
        {items.map((t, i) => (
          <li key={listenKey(t.listen, i)}>
            <ListenCard
              listen={t.listen}
              context={listens}
              feedback={fb.get(t.listen)}
              rank={i + 1}
              meta={plural(t.count, "listen")}
            />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ---------- weekdays ---------- */

export function WeekdayChart({ days, dayOfWeek }: { days: YimDay[]; dayOfWeek?: string }) {
  // Monday-first totals, summed from the daily counts.
  const totals = [0, 0, 0, 0, 0, 0, 0];
  days.forEach((d) => {
    totals[(new Date(d.ts * 1000).getUTCDay() + 6) % 7] += d.count;
  });
  const data: ColumnDatum[] = totals.map((count, i) => ({
    key: WEEKDAYS[i],
    label: WEEKDAYS[i].slice(0, 3),
    value: count,
    title: `${WEEKDAYS[i]}: ${plural(count, "listen")}`,
  }));
  return (
    <Panel title="Listens by day of week" aside={dayOfWeek ? `Most listened on ${dayOfWeek}s` : undefined}>
      <ColumnChart data={data} label="Listens by day of week" height={160} />
    </Panel>
  );
}

/* ---------- calendar ---------- */

export function ListensCalendar({ year, days }: { year: number; days: YimDay[] }) {
  const jan1 = Date.UTC(year, 0, 1);
  const lead = (new Date(jan1).getUTCDay() + 6) % 7; // row of Jan 1 with Monday first
  const max = Math.max(1, ...days.map((d) => d.count));
  const cells = days.map((d) => {
    const dayIndex = Math.round((d.ts * 1000 - jan1) / 86_400_000);
    const cell = dayIndex + lead;
    return { ...d, col: Math.floor(cell / 7), row: cell % 7 };
  });
  const cols = cells.length ? Math.max(...cells.map((c) => c.col)) + 1 : 1;
  const total = days.reduce((s, d) => s + d.count, 0);
  const busiest = days.reduce((a, b) => (b.count > a.count ? b : a), days[0]);

  return (
    <Panel title="Listens per day">
      <div className="overflow-x-auto">
        <div
          role="img"
          aria-label={`Listens per day in ${year}, ${plural(total, "listen")} in total`}
          className="grid min-w-[560px] gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {cells.map((c) => (
            <div
              key={c.ts}
              title={`${fmtDateLong(c.ts)}: ${plural(c.count, "listen")}`}
              className="aspect-square rounded-[2px]"
              style={{
                gridColumn: c.col + 1,
                gridRow: c.row + 1,
                background:
                  c.count > 0
                    ? `color-mix(in srgb, var(--data) ${Math.round(18 + (82 * c.count) / max)}%, #1c1c1c)`
                    : "#1c1c1c",
              }}
            />
          ))}
        </div>
      </div>
      <p className="mt-3 text-[13px] text-ink-2">
        {plural(total, "listen")} over {days.length} days. Busiest day: {fmtDateLong(busiest.ts)}, {plural(busiest.count, "listen")}.
      </p>
    </Panel>
  );
}

/* ---------- similar users ---------- */

export function SimilarUsers({ items }: { items: Array<{ name: string; score: number }> }) {
  return (
    <Panel title="Similar users" aside="Similarity this year">
      <ul className="flex flex-col gap-3">
        {items.map((u) => (
          <li key={u.name} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-[14px]">
                <UserLink name={u.name} avatar />
              </span>
              <span className="num flex-none text-[13px] text-ink-2">{Math.round(u.score * 100)}%</span>
            </div>
            <Bar value={u.score} max={1} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ---------- playlists ---------- */

export function PlaylistPanel({ playlist }: { playlist: YimPlaylist }) {
  const tracks = playlist.tracks.slice(0, 5);
  const fb = useListFeedback(tracks);
  return (
    <Panel
      title={playlist.label}
      aside={
        playlist.mbid ? (
          <Link href={`/playlist/${playlist.mbid}`} className="text-[13px] text-ink underline-offset-4 hover:underline">
            Open playlist
          </Link>
        ) : null
      }
    >
      {playlist.description ? <p className="mb-2 text-[13px] text-ink-2">{playlist.description}</p> : null}
      <ul className="flex flex-col">
        {tracks.map((l, i) => (
          <li key={listenKey(l, i)}>
            <ListenCard listen={l} context={tracks} feedback={fb.get(l)} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ---------- cover art ---------- */

export function CoverArtPanel({ src, username, year }: { src: string; username: string; year: number }) {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const failed = failedSrc === src;

  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`The server answered ${res.status}.`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `undertone-${username}-${year}.svg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.danger("Couldn't download the cover art", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Cover art"
      aside={
        failed ? null : (
          <Button size="sm" variant="tertiary" isDisabled={busy} onPress={download}>
            Download
          </Button>
        )
      }
    >
      {failed ? (
        <Empty>No cover art for {year} yet.</Empty>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${username}'s ${year} in music cover art`}
          onError={() => setFailedSrc(src)}
          className="mx-auto block w-full max-w-[420px] rounded-[12px] bg-raised"
        />
      )}
    </Panel>
  );
}
