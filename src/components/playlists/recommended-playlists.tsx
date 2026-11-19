"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, toast } from "@heroui/react";
import { useAuth } from "@/lib/auth";
import { useLB, errorMessage } from "@/lib/use-lb";
import { fmtDateLong, plural } from "@/lib/format";
import { usePlayer } from "@/components/player/player-context";
import { Empty, ErrorNote, Link, Panel, SkeletonRows, cx } from "@/components/ui";
import { PlaylistTrackList } from "./playlist-track-list";
import {
  createdTime,
  fetchAllUserPlaylists,
  playlistId,
  recommendationKind,
  recommendationYear,
  trackToListen,
  type RecommendationKind,
} from "./playlist-utils";

type Group = { kind: RecommendationKind; items: JSPFPlaylist[] };

/** "2024 Top Discoveries", "Weekly Jams", …; the playlist's own title for anything unknown. */
function displayTitle(pl: JSPFPlaylist): string {
  const kind = recommendationKind(pl);
  if (kind.key === "top-discoveries") return `${recommendationYear(pl) ?? ""} Top Discoveries`.trim();
  if (kind.key === "top-missed") return `${recommendationYear(pl) ?? ""} Missed Tracks`.trim();
  return kind.label;
}

/**
 * The playlists ListenBrainz generated for this user (created-for). The newest of each kind is listed
 * on the left; the selected one's tracks are on the right, with the earlier ones of its kind below.
 */
export function RecommendedPlaylists({ username }: { username: string }) {
  const { api, user } = useAuth();
  const player = usePlayer();
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [copying, setCopying] = React.useState(false);

  const { data, error, isLoading, mutate } = useLB(["created-for", username], (a, u) =>
    fetchAllUserPlaylists(a, username, u?.token, { createdFor: true })
  );

  const groups = React.useMemo<Group[]>(() => {
    const byKind = new Map<string, Group>();
    for (const o of data ?? []) {
      const pl = o.playlist;
      if (!pl) continue;
      const kind = recommendationKind(pl);
      const g = byKind.get(kind.key) ?? { kind, items: [] };
      g.items.push(pl);
      byKind.set(kind.key, g);
    }
    return [...byKind.values()]
      .map((g) => ({ ...g, items: [...g.items].sort((a, b) => createdTime(b) - createdTime(a)) }))
      .sort((a, b) => a.kind.order - b.kind.order);
  }, [data]);

  const selected = React.useMemo(() => {
    const all = groups.flatMap((g) => g.items);
    return all.find((p) => playlistId(p) === selectedId) ?? groups[0]?.items[0];
  }, [groups, selectedId]);
  const selectedKind = selected ? recommendationKind(selected).key : null;
  const sameKind = groups.find((g) => g.kind.key === selectedKind)?.items ?? [];
  const earlier = sameKind.filter((p) => playlistId(p) !== playlistId(selected));
  const listens = React.useMemo(() => (selected?.track ?? []).map(trackToListen), [selected]);

  const saveCopy = async () => {
    if (!user || !selected) return;
    setCopying(true);
    try {
      const newId = await api.copyPlaylist(user.token, playlistId(selected));
      toast.success("Saved to your playlists");
      router.push(`/playlist/${newId}`);
    } catch (e) {
      toast.danger("Couldn't save a copy", { description: errorMessage(e) });
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="flex flex-col gap-[14px] pb-2">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 pt-6">
        <h2 className="text-[16px] font-medium">Made for {username}</h2>
        <Link href={`/recommended/tracks/${encodeURIComponent(username)}`} muted className="text-[14px]">
          Recommended tracks
        </Link>
      </div>

      {error ? (
        <Panel>
          <ErrorNote error={error} onRetry={() => mutate()} />
        </Panel>
      ) : isLoading || !data ? (
        <Panel>
          <SkeletonRows rows={5} cover={false} />
        </Panel>
      ) : groups.length === 0 ? (
        <Panel>
          <Empty>No playlists yet.</Empty>
        </Panel>
      ) : (
        <div className="grid gap-[14px] lg:grid-cols-6">
          <Panel as="div" className="lg:col-span-2 lg:self-start" bodyClassName="flex flex-col gap-1">
            {groups.map((g) => {
              const newest = g.items[0];
              const on = g.kind.key === selectedKind;
              return (
                <button
                  key={g.kind.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelectedId(playlistId(newest))}
                  className={cx(
                    "flex min-h-[52px] flex-col items-start justify-center rounded-[12px] px-3 py-2 text-left transition-colors",
                    on ? "bg-raised" : "hover:bg-[#161616]"
                  )}
                >
                  <span className="text-[14px] font-medium leading-5">{displayTitle(newest)}</span>
                  <span className="num text-[12px] text-ink-3">
                    {fmtDateLong(newest.date)} · {plural(g.items.length, "playlist")}
                  </span>
                </button>
              );
            })}
          </Panel>

          <div className="flex flex-col gap-[14px] lg:col-span-4">
            {selected ? (
              <Panel
                title={displayTitle(selected)}
                aside={<span className="num">{fmtDateLong(selected.date)}</span>}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Button onPress={() => player.playQueue(listens, 0)} isDisabled={!listens.length}>
                    Play all
                  </Button>
                  {user ? (
                    <Button variant="secondary" onPress={saveCopy} isDisabled={copying} isPending={copying}>
                      Save a copy
                    </Button>
                  ) : null}
                  <Link href={`/playlist/${playlistId(selected)}`} muted className="ml-auto text-[13px]">
                    Open playlist
                  </Link>
                </div>
                {listens.length ? (
                  <PlaylistTrackList tracks={selected.track ?? []} canEdit={false} onMove={() => {}} onRemove={() => {}} />
                ) : (
                  <Empty>This playlist has no tracks.</Empty>
                )}
              </Panel>
            ) : null}

            {earlier.length ? (
              <Panel title={`Earlier ${selected ? recommendationKind(selected).label : ""}`.trim()}>
                <ul className="flex flex-col gap-1">
                  {earlier.map((p) => (
                    <li key={playlistId(p)}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(playlistId(p))}
                        className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-[12px] px-3 py-2 text-left hover:bg-[#161616]"
                      >
                        <span className="text-[14px] font-medium">{displayTitle(p)}</span>
                        <span className="num text-[12px] text-ink-3">
                          {fmtDateLong(p.date)} · {plural(p.track?.length ?? 0, "track")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
