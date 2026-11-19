"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Page, Panel, Empty, ErrorNote, SkeletonRows, Loading, cx } from "@/components/ui";
import { Button } from "@heroui/react";
import { useLB } from "@/lib/use-lb";
import { caaCover, releaseCover } from "@/lib/listen";
import { fmtDuration, fmtInt } from "@/lib/format";
import { ListenCard } from "@/components/listen/listen-card";
import { useListFeedback } from "@/lib/feedback";
import { usePlayer } from "@/components/player/player-context";
import { HuePicker, isHex6 } from "@/components/explore/color-picker";

type ReleaseLookup = {
  id: string;
  title: string;
  "artist-credit"?: Array<{ name: string; joinphrase?: string; artist: { id: string; name: string } }>;
  media?: Array<{ tracks: Array<{ title: string; length?: number; recording: { id: string } }> }>;
};

export default function HueSoundPage() {
  const params = useParams<{ color?: string[] }>();
  const router = useRouter();
  const hexParam = params.color?.[0];
  const hex = isHex6(hexParam) ? hexParam.toLowerCase() : undefined;
  // The selection belongs to one colour: a new colour simply does not match it any more.
  const [picked, setPicked] = React.useState<{ hex?: string; mbid: string } | null>(null);
  const selectedMBID = picked && picked.hex === hex ? picked.mbid : null;
  const setSelectedMBID = (mbid: string) => setPicked({ hex, mbid });

  const { data, error, isLoading, mutate } = useLB(hex ? ["huesound", hex] : null, (api) =>
    api.lookupReleaseFromColor(hex as string, 25) as Promise<ColorReleasesResponse>
  );

  const releases = React.useMemo(
    () => [...(data?.payload?.releases ?? [])].sort((a, b) => a.dist - b.dist),
    [data]
  );
  const selected = releases.find((r) => r.release_mbid === selectedMBID) ?? null;

  const commitColor = (next: string) => {
    if (next === hex) return;
    router.replace(`/explore/huesound/${next}`, { scroll: false });
  };

  return (
    <Page
      title="Huesound"
      subtitle="Pick a colour and see the releases whose cover art is closest to it, nearest first."
    >
      <div className="grid gap-[14px] lg:grid-cols-6">
        <Panel className="lg:col-span-2" title="Colour">
          <HuePicker hex={hex} onCommit={commitColor} />
        </Panel>

        <Panel
          className="lg:col-span-4"
          title={hex ? "Closest covers" : undefined}
          aside={hex && data ? <span className="num">{fmtInt(releases.length)} releases</span> : undefined}
        >
          {!hex ? (
            <Empty>Choose a colour on the left to see matching covers.</Empty>
          ) : isLoading ? (
            <Loading label="Finding covers" />
          ) : error ? (
            <ErrorNote error={error} onRetry={() => mutate()} />
          ) : releases.length === 0 ? (
            <Empty>No releases have cover art close to #{hex}. Try another colour.</Empty>
          ) : (
            <div className="grid grid-cols-3 gap-[10px] sm:grid-cols-4 md:grid-cols-5">
              {releases.map((r) => (
                <CoverButton
                  key={r.release_mbid}
                  release={r}
                  selected={r.release_mbid === selectedMBID}
                  onSelect={() => setSelectedMBID(r.release_mbid)}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      {selected ? <Tracklist release={selected} /> : null}
    </Page>
  );
}

function CoverButton({
  release,
  selected,
  onSelect,
}: {
  release: ColorReleaseItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const src = caaCover(release.release_mbid, release.caa_id, 250) ?? releaseCover(release.release_mbid, 250);
  const [failed, setFailed] = React.useState(false);
  const label = `${release.release_name} by ${release.artist_name}`;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Select ${label}`}
      title={label}
      className={cx(
        "group aspect-square w-full overflow-hidden rounded-[10px] bg-raised outline-none transition-shadow",
        selected ? "ring-2 ring-white" : "hover:ring-2 hover:ring-[#3a3a3a] focus-visible:ring-2 focus-visible:ring-white"
      )}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        <span aria-hidden className="flex size-full items-center justify-center text-[13px] text-ink-3">
          {release.release_name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </button>
  );
}

function Tracklist({ release }: { release: ColorReleaseItem }) {
  const player = usePlayer();
  const { data, error, isLoading, mutate } = useLB(["huesound-tracks", release.release_mbid], (api) =>
    api.lookupMBRelease(release.release_mbid, "recordings+artist-credits") as Promise<ReleaseLookup>
  );

  const listens = React.useMemo<Listen[]>(() => {
    if (!data) return [];
    const credits = data["artist-credit"] ?? [];
    const artistMBIDs = credits.map((c) => c.artist.id);
    const artists = credits.map((c) => ({
      artist_mbid: c.artist.id,
      artist_credit_name: c.name,
      join_phrase: c.joinphrase ?? "",
    }));
    const artistName = credits.map((c) => `${c.name}${c.joinphrase ?? ""}`).join("") || release.artist_name;
    return (data.media ?? []).flatMap((m) =>
      m.tracks.map<Listen>((t) => ({
        listened_at: 0,
        track_metadata: {
          track_name: t.title,
          artist_name: artistName,
          release_name: data.title,
          additional_info: {
            recording_mbid: t.recording.id,
            release_mbid: data.id,
            duration_ms: t.length,
            artist_mbids: artistMBIDs,
          },
          mbid_mapping: {
            recording_mbid: t.recording.id,
            release_mbid: data.id,
            artist_mbids: artistMBIDs,
            artists,
            caa_id: release.caa_id,
            caa_release_mbid: data.id,
          } as MBIDMapping,
        },
      }))
    );
  }, [data, release]);

  const fb = useListFeedback(listens);

  return (
    <Panel
      title={release.release_name}
      aside={
        listens.length ? (
          <Button size="sm" variant="secondary" onPress={() => player.playQueue(listens, 0)}>
            Play all
          </Button>
        ) : undefined
      }
    >
      <p className="mb-3 text-[13px] text-ink-2">
        {release.artist_name}
        {isLoading || !data ? null : (
          <span className="text-ink-3">
            {" "}
            · {fmtInt(listens.length)} tracks · {fmtDuration(listens.reduce((s, l) => s + (l.track_metadata.additional_info?.duration_ms ?? 0), 0))}
          </span>
        )}
      </p>
      {isLoading ? (
        <SkeletonRows rows={5} cover={false} pitch={52} />
      ) : error ? (
        <ErrorNote error={error} onRetry={() => mutate()} />
      ) : listens.length === 0 ? (
        <Empty>MusicBrainz has no track list for this release.</Empty>
      ) : (
        <div className="flex flex-col">
          {listens.map((l, i) => (
            <ListenCard
              key={`${l.track_metadata.additional_info?.recording_mbid}-${i}`}
              listen={l}
              context={listens}
              feedback={fb.get(l)}
              rank={i + 1}
              meta={fmtDuration(l.track_metadata.additional_info?.duration_ms)}
              canDelete={false}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
