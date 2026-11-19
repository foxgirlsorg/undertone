"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Button } from "@heroui/react";
import { Empty, ErrorNote, Page, Panel, SkeletonRows } from "@/components/ui";
import { ListenCard } from "@/components/listen/listen-card";
import { usePlayer } from "@/components/player/player-context";
import { useListFeedback } from "@/lib/feedback";
import { listenKey } from "@/lib/listen";
import { useLB } from "@/lib/use-lb";

type ReleaseLookup = MusicBrainzRelease &
  WithArtistCredits &
  WithMedia &
  Partial<WithReleaseGroup>;

/** A MusicBrainz release's tracks as Listen objects, so the player and ListenCard can use them. */
function releaseListens(r: ReleaseLookup): Listen[] {
  const releaseCredits = r["artist-credit"] ?? [];
  const releaseGroupMBID = r["release-group"]?.id;
  return (r.media ?? []).flatMap((medium) =>
    (medium.tracks ?? []).map((t) => {
      const rec = t.recording;
      const credits =
        (rec as { "artist-credit"?: MusicBrainzArtistCredit[] })["artist-credit"] ?? releaseCredits;
      const artists = credits.map((c) => ({
        artist_credit_name: c.name,
        artist_mbid: c.artist.id,
        join_phrase: c.joinphrase ?? "",
      }));
      const artistMBIDs = artists.map((a) => a.artist_mbid);
      return {
        listened_at: 0,
        track_metadata: {
          track_name: t.title || rec.title,
          artist_name: credits.map((c) => `${c.name}${c.joinphrase ?? ""}`).join(""),
          release_name: r.title,
          additional_info: {
            recording_mbid: rec.id,
            release_mbid: r.id,
            release_group_mbid: releaseGroupMBID,
            artist_mbids: artistMBIDs,
            duration_ms: t.length || rec.length || undefined,
          },
          mbid_mapping: {
            recording_mbid: rec.id,
            release_mbid: r.id,
            artists,
          },
        },
      } as unknown as Listen;
    })
  );
}

export default function ReleasePlayerPage() {
  const { releaseMBID } = useParams<{ releaseMBID: string }>();
  const mbid = decodeURIComponent(releaseMBID ?? "");
  const { playQueue } = usePlayer();

  const release = useLB(["mb-release-player", mbid], (api) =>
    api.lookupMBRelease(mbid, "recordings+artist-credits+release-groups") as Promise<ReleaseLookup>
  );
  const listens = React.useMemo(
    () => (release.data ? releaseListens(release.data) : []),
    [release.data]
  );
  const fb = useListFeedback(listens);

  const artist = (release.data?.["artist-credit"] ?? [])
    .map((c) => `${c.name}${c.joinphrase ?? ""}`)
    .join("");
  const subtitle = [artist, release.data?.date].filter(Boolean).join(" · ") || undefined;

  return (
    <Page
      title={release.data?.title ?? "Release"}
      subtitle={subtitle}
      actions={
        listens.length ? (
          <Button onPress={() => playQueue(listens, 0)}>Play release</Button>
        ) : null
      }
    >
      {release.error ? <ErrorNote error={release.error} onRetry={() => void release.mutate()} /> : null}
      <Panel
        title="Tracks"
        aside={listens.length ? <span className="num">{listens.length} tracks</span> : null}
      >
        {release.isLoading ? (
          <SkeletonRows rows={8} />
        ) : listens.length === 0 && !release.error ? (
          <Empty>This release has no tracks on MusicBrainz.</Empty>
        ) : (
          <div className="flex flex-col gap-0.5">
            {listens.map((l, i) => (
              <ListenCard key={listenKey(l, i)} listen={l} context={listens} feedback={fb.get(l)} />
            ))}
          </div>
        )}
      </Panel>
    </Page>
  );
}
