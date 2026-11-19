"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Empty, ErrorNote, Page, Panel, SkeletonRows } from "@/components/ui";
import { ListenCard } from "@/components/listen/listen-card";
import { usePlayer } from "@/components/player/player-context";
import { useListFeedback } from "@/lib/feedback";
import { jspfTrackToListen, listenKey } from "@/lib/listen";
import { useLB } from "@/lib/use-lb";

export default function PlayerPageRoute() {
  return (
    <React.Suspense fallback={null}>
      <PlayerPage />
    </React.Suspense>
  );
}

/**
 * /player?playlist=<playlistMBID> plays a playlist once it has loaded, then shows the current queue.
 * Without the parameter it just shows whatever is in the queue.
 */
function PlayerPage() {
  const params = useSearchParams();
  const playlistMBID = params.get("playlist")?.trim() || null;
  const { queue, playQueue } = usePlayer();
  const fb = useListFeedback(queue);

  const playlist = useLB(playlistMBID ? ["player-playlist", playlistMBID] : null, async (api, user) => {
    if (!playlistMBID) throw new Error("No playlist given.");
    const res = await api.getPlaylist(playlistMBID, user?.token);
    const body = (await res.json()) as JSPFObject;
    return body.playlist;
  });

  const startedFor = React.useRef<string | null>(null);
  const loadedTracks = playlist.data?.track;
  React.useEffect(() => {
    if (!playlistMBID || !loadedTracks || startedFor.current === playlistMBID) return;
    startedFor.current = playlistMBID;
    const listens = loadedTracks.map(jspfTrackToListen);
    if (listens.length) playQueue(listens, 0);
  }, [playlistMBID, loadedTracks, playQueue]);

  const title = playlist.data?.title ?? (playlistMBID ? "Playlist" : "Player");
  const subtitle = playlist.data?.creator ? `By ${playlist.data.creator}` : undefined;

  return (
    <Page title={title} subtitle={subtitle}>
      {playlistMBID && playlist.error ? (
        <ErrorNote error={playlist.error} onRetry={() => void playlist.mutate()} />
      ) : null}
      {playlistMBID && playlist.isLoading ? (
        <Panel>
          <SkeletonRows rows={5} />
        </Panel>
      ) : null}

      <Panel
        title="Queue"
        aside={queue.length ? <span className="num">{queue.length} tracks</span> : null}
      >
        {queue.length === 0 ? (
          <Empty>Nothing is queued. Open a playlist or album to play it here.</Empty>
        ) : (
          <div className="flex flex-col gap-0.5">
            {queue.map((l, i) => (
              <ListenCard key={listenKey(l, i)} listen={l} context={queue} feedback={fb.get(l)} />
            ))}
          </div>
        )}
      </Panel>
    </Page>
  );
}
