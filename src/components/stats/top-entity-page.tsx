"use client";

/* Full top-N list (artists, albums or tracks) with the range control, 100 per page and a play-all for tracks. */

import * as React from "react";
import { Button } from "@heroui/react";
import { ListenCard } from "@/components/listen/listen-card";
import { usePlayer } from "@/components/player/player-context";
import { ErrorNote, Empty, RangeTabs, SkeletonRows } from "@/components/ui";
import { useListFeedback } from "@/lib/feedback";
import { useLB } from "@/lib/use-lb";
import { caaCover, releaseGroupCover } from "@/lib/listen";
import { fmtInt } from "@/lib/format";
import { RankRow } from "./blocks";
import { isNotCalculated, recordingToListen, usePageParam, useStatsRange, type TopEntity } from "./use-stats";

const PAGE_SIZE = 100;

const TITLES: Record<TopEntity, string> = {
  artist: "Top artists",
  "release-group": "Top albums",
  recording: "Top tracks",
};

type ListRow = {
  key: string;
  title: string;
  sub?: string;
  href?: string;
  cover?: string;
  count: number;
  listen?: Listen;
};

function toListRows(data: UserEntityResponse | undefined, entity: TopEntity): { rows: ListRow[]; total: number } {
  if (!data) return { rows: [], total: 0 };
  if (entity === "artist") {
    const p = (data as UserArtistsResponse).payload;
    return {
      total: p.total_artist_count ?? 0,
      rows: p.artists.map((a, i) => ({
        key: `${a.artist_mbid ?? a.artist_name}-${i}`,
        title: a.artist_name,
        href: a.artist_mbid ? `/artist/${a.artist_mbid}` : undefined,
        count: a.listen_count,
      })),
    };
  }
  if (entity === "release-group") {
    const p = (data as UserReleaseGroupsResponse).payload;
    return {
      total: p.total_release_group_count ?? 0,
      rows: p.release_groups.map((a, i) => ({
        key: `${a.release_group_mbid ?? a.release_group_name}-${i}`,
        title: a.release_group_name,
        sub: a.artist_name,
        href: a.release_group_mbid ? `/album/${a.release_group_mbid}` : undefined,
        cover: caaCover(a.caa_release_mbid, a.caa_id) ?? releaseGroupCover(a.release_group_mbid),
        count: a.listen_count,
      })),
    };
  }
  const p = (data as UserRecordingsResponse).payload;
  return {
    total: p.total_recording_count ?? 0,
    rows: p.recordings.map((r, i) => ({
      key: `${r.recording_mbid ?? r.track_name}-${i}`,
      title: r.track_name,
      sub: r.artist_name,
      count: r.listen_count,
      listen: recordingToListen(r),
    })),
  };
}

export function TopEntityPage({ user, entity }: { user?: string; entity: TopEntity }) {
  const [range, setRange] = useStatsRange("all_time");
  const [page, setPage] = usePageParam();
  const player = usePlayer();
  const offset = (page - 1) * PAGE_SIZE;

  const q = useLB(["stats-top-list", user ?? "sitewide", entity, range, offset], (api) =>
    api.getUserEntity(user, entity, range, offset, PAGE_SIZE)
  );
  const { rows, total } = React.useMemo(() => toListRows(q.data, entity), [q.data, entity]);
  const listens = React.useMemo(() => rows.flatMap((r) => (r.listen ? [r.listen] : [])), [rows]);
  const fb = useListFeedback(listens);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total ? offset + 1 : 0;
  const to = offset + rows.length;
  const title = TITLES[entity];

  let body: React.ReactNode;
  if (q.error) {
    body = isNotCalculated(q.error) ? (
      <Empty>{"Stats for this period aren't calculated yet."}</Empty>
    ) : (
      <ErrorNote error={q.error} onRetry={() => void q.mutate()} />
    );
  } else if (q.data === undefined) {
    body = <SkeletonRows rows={10} cover={entity !== "artist"} pitch={52} />;
  } else if (rows.length === 0) {
    body = <Empty>Nothing listened to in this period.</Empty>;
  } else if (entity === "recording") {
    body = (
      <div className="flex flex-col">
        {rows.map((r, i) =>
          r.listen ? (
            <ListenCard
              key={r.key}
              listen={r.listen}
              context={listens}
              feedback={fb.get(r.listen)}
              rank={offset + i + 1}
              meta={`${fmtInt(r.count)} listens`}
            />
          ) : null
        )}
      </div>
    );
  } else {
    body = (
      <ul className="flex flex-col">
        {rows.map((r, i) => (
          <RankRow
            key={r.key}
            rank={offset + i + 1}
            title={r.title}
            href={r.href}
            sub={r.sub}
            meta={`${fmtInt(r.count)} listens`}
            showCover={entity === "release-group"}
            cover={r.cover}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex flex-col gap-3">
        {user ? (
          <h2 className="text-[16px] font-medium leading-6">{title}</h2>
        ) : (
          <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.01em]">{title}</h1>
        )}
        <RangeTabs value={range} onChange={setRange} />
      </div>

      <section className="rounded-[20px] bg-card p-[22px]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <span className="num text-[13px] text-ink-3">
            {total ? `${fmtInt(from)}–${fmtInt(to)} of ${fmtInt(total)}` : ""}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {entity === "recording" && rows.length ? (
              <Button
                size="sm"
                variant="secondary"
                onPress={() => player.playQueue(listens, 0)}
              >
                {total <= rows.length ? "Play all" : "Play this page"}
              </Button>
            ) : null}
            <Button size="sm" variant="tertiary" isDisabled={page <= 1} onPress={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button
              size="sm"
              variant="tertiary"
              isDisabled={page >= totalPages}
              onPress={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
        {body}
      </section>

      <span className="sr-only" aria-live="polite">
        {total ? `Page ${page} of ${totalPages}` : ""}
      </span>
    </div>
  );
}
