"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Button } from "@heroui/react";
import { LB_WEB_URL, MB_URL } from "@/lib/config";
import { useLB } from "@/lib/use-lb";
import { fmtDateLong, fmtInt } from "@/lib/format";
import { caaCover, releaseGroupCover } from "@/lib/listen";
import { CoverArt, Empty, ErrorNote, Link, Panel, SkeletonRows, UserLink } from "@/components/ui";
import { ButtonLink, EntityHeader, ListenRows, StatBlock, TagPills } from "@/components/entity/entity-parts";
import { mbQueued, creditName, creditsToRefs } from "@/components/entity/mb";
import {
  fetchReleaseGroupListeners,
  fetchReleaseGroupMetadata,
  makeListen,
} from "@/components/entity/data";
import { usePlayer } from "@/components/player/player-context";

type MBRelease = MusicBrainzRelease & WithMedia & { "artist-credit"?: MusicBrainzArtistCredit[] };

/** The date string MusicBrainz gives: 2007-10-10, 2007-10 or 2007. */
const prettyDate = (d?: string) => (!d ? undefined : d.length === 10 ? fmtDateLong(d) : d);

/** "2× CD · Digital Media" from the media list of a release. */
function formatsOf(media: MusicBrainzMedia[] | undefined) {
  const counts = new Map<string, number>();
  (media ?? []).forEach((m) => counts.set(m.format || "Unknown", (counts.get(m.format || "Unknown") ?? 0) + 1));
  return Array.from(counts, ([f, n]) => (n > 1 ? `${n}× ${f}` : f)).join(" · ");
}

const isOfficial = (r: { status?: string }) => r.status === "Official";

export default function AlbumPage() {
  const { albumMBID } = useParams<{ albumMBID: string }>();
  const mbid = decodeURIComponent(albumMBID);
  const player = usePlayer();
  const [releasesOpenFor, setReleasesOpenFor] = React.useState<string | null>(null);
  const showAllReleases = releasesOpenFor === mbid;
  const setShowAllReleases = (open: boolean) => setReleasesOpenFor(open ? mbid : null);

  // Step 1: the release group with its releases (one MB request, queued).
  const rg = useLB(["album-mb", mbid], (api) => mbQueued(() => api.lookupMBReleaseGroup(mbid)));

  const releases = React.useMemo(() => {
    const list = rg.data?.releases ?? [];
    return [...list].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  }, [rg.data]);

  const firstOfficial = React.useMemo(
    () => releases.find(isOfficial) ?? releases[0],
    [releases]
  );

  // Step 2: the tracklist of the first official release, chained after step 1.
  const tracklist = useLB(firstOfficial ? ["album-release-tracks", firstOfficial.id] : null, (api) =>
    mbQueued(() => api.lookupMBRelease(firstOfficial!.id, "recordings+artist-credits+media")) as Promise<MBRelease>
  );

  const meta = useLB(["album-meta", mbid], () => fetchReleaseGroupMetadata(mbid));
  const listeners = useLB(["album-listeners", mbid], () => fetchReleaseGroupListeners(mbid));

  const creditRefs = React.useMemo(() => creditsToRefs(rg.data?.["artist-credit"]), [rg.data]);
  const artistLine = creditName(creditRefs);
  const title = rg.data?.title ?? meta.data?.release_group?.name ?? "";

  // Each disc of the tracklist as ListenCards; the listens carry duration, MBIDs and cover data.
  const discs = React.useMemo(() => {
    const rel = tracklist.data;
    if (!rel?.media) return [];
    const fallbackRefs = creditRefs;
    return rel.media.map((m) => {
      const listens = m.tracks.map((t) => {
        const tc = (t as MusicBrainzTrack & { "artist-credit"?: MusicBrainzArtistCredit[] })["artist-credit"];
        const refs = tc ? creditsToRefs(tc) : fallbackRefs;
        return makeListen({
          track: t.title,
          artist: creditName(refs),
          artists: refs,
          recording_mbid: t.recording?.id,
          duration_ms: t.length ?? t.recording?.length ?? undefined,
          release: rel.title,
          release_mbid: rel.id,
          release_group_mbid: mbid,
          caa_release_mbid: rel.id,
        });
      });
      return { position: m.position, format: m.format, title: m.title, listens };
    });
  }, [tracklist.data, creditRefs, mbid]);

  const allListens = React.useMemo(() => discs.flatMap((d) => d.listens), [discs]);
  const tags = React.useMemo(
    () =>
      [...(meta.data?.tag?.release_group ?? [])].sort((a, b) => b.count - a.count).map((t) => ({ name: t.tag })),
    [meta.data]
  );

  const rgInfo = rg.data;
  const coverSrc =
    caaCover(meta.data?.release_group?.caa_release_mbid, meta.data?.release_group?.caa_id, 250) ??
    releaseGroupCover(mbid, 250);

  const typeLine = rgInfo
    ? [rgInfo["primary-type"], ...(rgInfo["secondary-types"] ?? [])].filter(Boolean).join(" + ")
    : undefined;

  return (
    <div className="flex flex-col gap-[14px] pb-2 pt-6">
      {rg.error ? (
        <ErrorNote error={rg.error} onRetry={() => rg.mutate()} />
      ) : rg.isLoading && !rgInfo ? (
        <section className="rounded-[20px] bg-card p-[22px]">
          <SkeletonRows rows={1} cover={false} pitch={96} />
        </section>
      ) : rgInfo ? (
        <EntityHeader
          cover={<CoverArt src={coverSrc} alt={title} size={160} rounded={8} />}
          title={title}
          credit={
            creditRefs.length ? (
              <>
                {creditRefs.map((c, i) => (
                  <React.Fragment key={`${c.artist_mbid}-${i}`}>
                    <Link href={`/artist/${c.artist_mbid}`} className="font-medium">
                      {c.artist_credit_name}
                    </Link>
                    {c.join_phrase}
                  </React.Fragment>
                ))}
              </>
            ) : (
              artistLine
            )
          }
          meta={[typeLine, prettyDate(rgInfo["first-release-date"])]}
          tags={tags.length ? <TagPills tags={tags} /> : undefined}
          actions={
            <>
              <Button isDisabled={!allListens.length} onPress={() => player.playQueue(allListens, 0)}>
                Play all
              </Button>
              <ButtonLink href={`${MB_URL}/release-group/${mbid}`} external variant="tertiary">
                Open in MusicBrainz
              </ButtonLink>
              <ButtonLink href={`${LB_WEB_URL}/album/${mbid}/`} external variant="tertiary">
                ListenBrainz page
              </ButtonLink>
            </>
          }
        />
      ) : null}

      <div className="grid gap-[14px] lg:grid-cols-6">
        <Panel
          title="Tracklist"
          aside={
            firstOfficial && tracklist.data ? (
              <span>
                {prettyDate(firstOfficial.date) ?? "Release"} · {formatsOf(firstOfficial.media)}
              </span>
            ) : undefined
          }
          className="lg:col-span-4"
          bodyClassName="-mx-2"
        >
          {rg.isLoading || tracklist.isLoading ? (
            <SkeletonRows rows={8} />
          ) : tracklist.error ? (
            <ErrorNote error={tracklist.error} onRetry={() => tracklist.mutate()} />
          ) : !firstOfficial ? (
            <Empty>MusicBrainz has no releases for this album yet.</Empty>
          ) : !discs.length ? (
            <Empty>The tracklist of this release isn&apos;t available.</Empty>
          ) : (
            <div className="flex flex-col gap-4">
              {discs.map((d, i) => (
                <div key={`${d.position}-${i}`}>
                  {discs.length > 1 ? (
                    <h3 className="px-2 pb-1 text-[13px] text-ink-2">
                      Disc {d.position}
                      {d.format ? <span className="text-ink-3"> · {d.format}</span> : null}
                      {d.title ? <span className="text-ink-3"> · {d.title}</span> : null}
                    </h3>
                  ) : null}
                  <ListenRows listens={d.listens} rank />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Top listeners" className="lg:col-span-2">
          {listeners.isLoading ? (
            <SkeletonRows rows={5} cover={false} pitch={44} />
          ) : listeners.error ? (
            <ErrorNote error={listeners.error} onRetry={() => listeners.mutate()} />
          ) : !listeners.data ? (
            <Empty>Listener stats for this album aren&apos;t calculated yet.</Empty>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-4">
                <StatBlock label="Listeners" value={fmtInt(listeners.data.total_user_count)} />
                <StatBlock label="Listens" value={fmtInt(listeners.data.total_listen_count)} />
              </div>
              <ol className="flex flex-col">
                {listeners.data.listeners.slice(0, 10).map((u) => (
                  <li key={u.user_name} className="flex items-center justify-between gap-3 py-1.5 text-[14px]">
                    <UserLink name={u.user_name} avatar />
                    <span className="num text-ink-2">{fmtInt(u.listen_count)}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </Panel>

        <Panel title="Other releases" className="lg:col-span-6">
          {rg.isLoading ? (
            <SkeletonRows rows={3} cover={false} pitch={48} />
          ) : !releases.length ? (
            <Empty>No other releases of this album are listed on MusicBrainz.</Empty>
          ) : (
            <>
              <ul className="flex flex-col">
                {(showAllReleases ? releases : releases.slice(0, 10)).map((r) => {
                  const tracks = (r.media ?? []).reduce((n, m) => n + (m["track-count"] ?? 0), 0);
                  const detail = [prettyDate(r.date), r.country, formatsOf(r.media), tracks ? `${fmtInt(tracks)} tracks` : undefined]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
                      <div className="min-w-0">
                        <Link href={`/release/${r.id}`} className="text-[14px] font-medium">
                          {r.title}
                        </Link>
                        {r.disambiguation ? <span className="text-[13px] text-ink-3"> ({r.disambiguation})</span> : null}
                      </div>
                      <span className="text-[12px] text-ink-3">{detail}</span>
                    </li>
                  );
                })}
              </ul>
              {releases.length > 10 ? (
                <div className="mt-2">
                  <Button size="sm" variant="tertiary" onPress={() => setShowAllReleases(!showAllReleases)}>
                    {showAllReleases ? "Show fewer" : `Show all ${fmtInt(releases.length)}`}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

