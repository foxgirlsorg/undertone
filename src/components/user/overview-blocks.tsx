"use client";

/*
  Blocks of the profile overview. Stats come from the shared stats hooks (same SWR keys as the stats
  screens, so nothing is fetched twice). Every block owns its loading, not-calculated, empty and error states.
*/

import * as React from "react";
import NextLink from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { usePlayer } from "@/components/player/player-context";
import { CoverArt, Empty, ErrorNote, Link, Panel, SkeletonRows } from "@/components/ui";
import { ListenCard } from "@/components/listen/listen-card";
import { useLB } from "@/lib/use-lb";
import { useListFeedback } from "@/lib/feedback";
import { plural } from "@/lib/format";
import { caaCover, releaseCover } from "@/lib/listen";
import { fetchListensPage, listenRowKey } from "@/components/user/data";
import {
  albumCover,
  albumsOf,
  artistsOf,
  isNotCalculated,
  recordingToListen,
  tracksOf,
  useTopEntity,
  type RecordingEntity,
} from "@/components/stats/use-stats";

/** The overview's period control. Keys are the stats API ranges; labels are day counts. */
export const OVERVIEW_RANGES: Array<{ key: UserStatsAPIRange; label: string }> = [
  { key: "week", label: "Last 7 days" },
  { key: "month", label: "Last 30 days" },
  { key: "quarter", label: "Last 90 days" },
  { key: "half_yearly", label: "Last 180 days" },
  { key: "year", label: "Last 365 days" },
  { key: "all_time", label: "All time" },
];

const TOP_COUNT = 10;

/* ---------- shared state handling ---------- */

type Query<T> = { data: T | undefined; error: unknown; mutate: () => unknown };

function Body<T>({
  q,
  loading,
  isEmpty,
  emptyText,
  children,
}: {
  q: Query<T>;
  loading: React.ReactNode;
  isEmpty: (d: T) => boolean;
  emptyText: string;
  children: (d: T) => React.ReactNode;
}) {
  if (q.error) {
    if (isNotCalculated(q.error)) return <NotCalculated />;
    return <ErrorNote error={q.error} onRetry={() => void q.mutate()} />;
  }
  if (q.data === undefined) return <>{loading}</>;
  if (isEmpty(q.data)) return <Empty>{emptyText}</Empty>;
  return <>{children(q.data)}</>;
}

/** No stats for the chosen period: say so and offer all-time, which is almost always computed. */
function NotCalculated() {
  const params = useSearchParams();
  const pathname = usePathname();
  const onAllTime = params.get("range") === "all_time";
  const next = new URLSearchParams(params.toString());
  next.set("range", "all_time");
  return (
    <Empty
      action={
        onAllTime ? null : (
          <NextLink
            href={`${pathname}?${next.toString()}`}
            scroll={false}
            className="flex h-9 flex-none items-center whitespace-nowrap rounded-full bg-[#222] px-4 text-[13px] font-medium text-white hover:bg-[#2a2a2a]"
          >
            Show all time
          </NextLink>
        )
      }
    >
      {onAllTime ? "Stats aren't calculated yet." : "No stats for this period yet."}
    </Empty>
  );
}

/** Panel aside: "View all" to the full top list for this period. */
function ViewAll({ href }: { href: string }) {
  return (
    <Link href={href} className="text-ink hover:text-data">
      View all
    </Link>
  );
}

/**
 * One row of a top list. The bar behind the row is the listen count relative to the top row,
 * in the data hue at 18%. It is the only colour in the list.
 */
function BarRow({
  rank,
  share,
  children,
}: {
  rank: number;
  share: number;
  children: React.ReactNode;
}) {
  return (
    <li className="relative flex min-h-[48px] items-center gap-3 overflow-hidden rounded-[10px] px-2 py-1.5 transition-colors hover:bg-[#161616]">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 rounded-[10px]"
        style={{ width: `${share}%`, background: "color-mix(in srgb, var(--data) 18%, transparent)" }}
      />
      <span className="num relative w-6 flex-none text-right text-[13px] text-ink-3">{rank}</span>
      {children}
    </li>
  );
}

const shareOf = (value: number, max: number) => (max > 0 ? Math.max(2, (value / max) * 100) : 0);

/* ---------- recent listens ---------- */

/** Playing now (refreshed every 30 s) and the latest listens, compact. Full paging lives on the listens page. */
export function RecentListensPreview({ name }: { name: string }) {
  const base = `/user/${encodeURIComponent(name)}`;
  const page = useLB(["user-listens", name, 0, 0], (api) => fetchListensPage(api, name));
  const nowQuery = useLB(["playing-now", name], (api) => api.getPlayingNowForUser(name), {
    refreshInterval: 30_000,
  });

  const nowListen = React.useMemo(
    () => (nowQuery.data ? ({ ...nowQuery.data, playing_now: true } as Listen) : undefined),
    [nowQuery.data]
  );
  const listens = React.useMemo(() => (page.data?.listens ?? []).slice(0, TOP_COUNT), [page.data]);
  const fb = useListFeedback(nowListen ? [nowListen, ...listens] : listens);

  return (
    <Panel title="Recent listens" aside={<Link href={`${base}/listens`} className="text-ink hover:text-data">View all</Link>}>
      {page.isLoading && !page.data ? (
        <SkeletonRows rows={6} pitch={56} />
      ) : page.error && !page.data ? (
        <ErrorNote error={page.error} onRetry={() => page.mutate()} />
      ) : nowListen || listens.length ? (
        <div className="flex flex-col">
          {nowListen ? (
            <ListenCard
              key="playing-now"
              listen={nowListen}
              context={listens}
              feedback={fb.get(nowListen)}
              canDelete={false}
              compact
            />
          ) : null}
          {listens.map((l) => (
            <ListenCard
              key={listenRowKey(l)}
              listen={l}
              context={listens}
              feedback={fb.get(l)}
              compact
            />
          ))}
        </div>
      ) : (
        <Empty>No listens yet.</Empty>
      )}
    </Panel>
  );
}

/* ---------- top artists ---------- */

export function TopArtistsBlock({ name, range, className }: { name: string; range: UserStatsAPIRange; className?: string }) {
  const q = useTopEntity(name, "artist", range, 0, TOP_COUNT);
  return (
    <Panel
      title="Top artists"
      className={className}
      aside={<ViewAll href={`/user/${encodeURIComponent(name)}/stats/top-artists?range=${range}`} />}
    >
      <Body
        q={q}
        loading={<SkeletonRows rows={5} cover={false} pitch={48} />}
        emptyText="No artists in this period."
        isEmpty={(d) => artistsOf(d).length === 0}
      >
        {(d) => {
          const rows = artistsOf(d).slice(0, TOP_COUNT);
          const max = rows[0]?.listen_count ?? 0;
          return (
            <ol className="flex flex-col">
              {rows.map((a, i) => (
                <BarRow key={`${a.artist_mbid ?? a.artist_name}-${i}`} rank={i + 1} share={shareOf(a.listen_count, max)}>
                  <span className="relative min-w-0 flex-1 truncate text-[14px] font-medium">
                    {a.artist_mbid ? <Link href={`/artist/${a.artist_mbid}`}>{a.artist_name}</Link> : a.artist_name}
                  </span>
                  <span className="num relative flex-none text-[13px] text-ink-2">{plural(a.listen_count, "listen")}</span>
                </BarRow>
              ))}
            </ol>
          );
        }}
      </Body>
    </Panel>
  );
}

/* ---------- top albums ---------- */

/** A cover that keeps its square at every width; initials on the quiet tile when there is no image. */
function SquareCover({ src, alt }: { src?: string; alt: string }) {
  const [failedSrc, setFailedSrc] = React.useState<string>();
  const failed = !!src && failedSrc === src;
  const initials = alt
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <div className="aspect-square w-full overflow-hidden rounded-[12px] bg-raised">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailedSrc(src)}
          className="size-full object-cover"
        />
      ) : (
        <div role="img" aria-label={alt} className="flex size-full items-center justify-center text-[18px] font-medium text-ink-3">
          {initials || "—"}
        </div>
      )}
    </div>
  );
}

export function TopAlbumsBlock({ name, range, className }: { name: string; range: UserStatsAPIRange; className?: string }) {
  const q = useTopEntity(name, "release-group", range, 0, TOP_COUNT);
  return (
    <Panel
      title="Top albums"
      className={className}
      aside={<ViewAll href={`/user/${encodeURIComponent(name)}/stats/top-albums?range=${range}`} />}
    >
      <Body
        q={q}
        loading={
          <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-3 lg:grid-cols-5" aria-busy="true" aria-label="Loading">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="skel aspect-square w-full" />
            ))}
          </div>
        }
        emptyText="No albums in this period."
        isEmpty={(d) => albumsOf(d).length === 0}
      >
        {(d) => (
          <ul className="grid grid-cols-2 gap-x-[14px] gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
            {albumsOf(d)
              .slice(0, TOP_COUNT)
              .map((a, i) => {
                const body = (
                  <>
                    <SquareCover src={albumCover(a)} alt={a.release_group_name} />
                    <div className="mt-2 truncate text-[14px] font-medium leading-5 group-hover:text-data">
                      {a.release_group_name}
                    </div>
                    <div className="truncate text-[13px] leading-5 text-ink-2">{a.artist_name}</div>
                    <div className="num text-[12px] leading-5 text-ink-3">{plural(a.listen_count, "listen")}</div>
                  </>
                );
                return (
                  <li key={`${a.release_group_mbid ?? a.release_group_name}-${i}`} className="group min-w-0">
                    {a.release_group_mbid ? (
                      <NextLink href={`/album/${a.release_group_mbid}`} className="block rounded-[12px]">
                        {body}
                      </NextLink>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </Body>
    </Panel>
  );
}

/* ---------- top tracks ---------- */

export function TopTracksBlock({ name, range, className }: { name: string; range: UserStatsAPIRange; className?: string }) {
  const q = useTopEntity(name, "recording", range, 0, TOP_COUNT);
  return (
    <Panel
      title="Top tracks"
      className={className}
      aside={<ViewAll href={`/user/${encodeURIComponent(name)}/stats/top-tracks?range=${range}`} />}
    >
      <Body
        q={q}
        loading={<SkeletonRows rows={5} pitch={52} />}
        emptyText="No tracks in this period."
        isEmpty={(d) => tracksOf(d).length === 0}
      >
        {(d) => <TrackRows recordings={tracksOf(d).slice(0, TOP_COUNT)} />}
      </Body>
    </Panel>
  );
}

function TrackRows({ recordings }: { recordings: RecordingEntity[] }) {
  const player = usePlayer();
  const listens = React.useMemo(() => recordings.map(recordingToListen), [recordings]);
  const max = recordings[0]?.listen_count ?? 0;
  return (
    <ol className="flex flex-col">
      {recordings.map((r, i) => {
        const listen = listens[i];
        const title = r.track_name;
        return (
          <BarRow key={`${r.recording_mbid ?? r.track_name}-${i}`} rank={i + 1} share={shareOf(r.listen_count, max)}>
            <button
              type="button"
              onClick={() => player.playListen(listen, listens)}
              aria-label={`Play ${title} by ${r.artist_name}`}
              className="group relative flex-none rounded"
            >
              <CoverArt
                src={caaCover(r.caa_release_mbid, r.caa_id) ?? releaseCover(r.release_mbid)}
                alt={r.release_name || title}
                size={40}
              />
              <span className="absolute inset-0 flex items-center justify-center rounded bg-black/60 text-[12px] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                Play
              </span>
            </button>
            <div className="relative min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium leading-5">
                {r.recording_mbid ? <Link href={`/track/${r.recording_mbid}`}>{title}</Link> : title}
              </div>
              <div className="truncate text-[13px] leading-5 text-ink-2">{r.artist_name}</div>
            </div>
            <span className="num relative flex-none text-[13px] text-ink-2">{plural(r.listen_count, "listen")}</span>
          </BarRow>
        );
      })}
    </ol>
  );
}

