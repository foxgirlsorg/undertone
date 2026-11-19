"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Button } from "@heroui/react";
import { LB_WEB_URL, MB_URL } from "@/lib/config";
import { useLB } from "@/lib/use-lb";
import { fmtInt } from "@/lib/format";
import { CoverArt, Empty, ErrorNote, Link, Panel, SkeletonRows, UserLink, cx } from "@/components/ui";
import { ListenRows, ButtonLink, EntityHeader, ReleaseTile, StatBlock, TagPills, playsLabel } from "@/components/entity/entity-parts";
import {
  fetchArtistListeners,
  fetchArtistMetadata,
  fetchMBArtistDetail,
  fetchSimilarArtists,
  fetchTopRecordingsForArtist,
  fetchTopReleaseGroupsForArtist,
  fetchWikipediaSummary,
  popularRecordingToListen,
  type ArtistReleaseGroup,
} from "@/components/entity/data";
import { usePlayer } from "@/components/player/player-context";
import { releaseGroupCover, caaCover } from "@/lib/listen";

const GROUP_ORDER = ["Album", "EP", "Single", "Other"] as const;
type GroupKey = (typeof GROUP_ORDER)[number];
const GROUP_LIMIT = 12;

/** Album / EP / Single only when there is no secondary type (Live, Compilation, Remix…) — those go to Other. */
const groupOf = (rg: ArtistReleaseGroup): GroupKey => {
  if (rg.secondary_types?.length) return "Other";
  return rg.type === "Album" || rg.type === "EP" || rg.type === "Single" ? rg.type : "Other";
};

const yearOf = (date?: string) => (date ? date.slice(0, 4) : undefined);

function lifeSpan(begin?: string | null, end?: string | null, ended?: boolean) {
  if (!begin && !end) return undefined;
  if (!end && !ended) return `${begin ?? ""}–`;
  return `${begin ?? "?"}–${end ?? ""}`;
}

export default function ArtistPage() {
  const { artistMBID } = useParams<{ artistMBID: string }>();
  const mbid = decodeURIComponent(artistMBID);
  const player = usePlayer();

  const meta = useLB(["artist-meta", mbid], () => fetchArtistMetadata(mbid));
  const mb = useLB(["artist-mb", mbid], () => fetchMBArtistDetail(mbid));
  const topRecs = useLB(["artist-top-recordings", mbid], () => fetchTopRecordingsForArtist(mbid));
  const topRGs = useLB(["artist-top-rgs", mbid], () => fetchTopReleaseGroupsForArtist(mbid));
  const listeners = useLB(["artist-listeners", mbid], () => fetchArtistListeners(mbid));
  const similar = useLB(["artist-similar", mbid], () => fetchSimilarArtists(mbid));
  const wiki = useLB(mb.data ? ["artist-wiki", mbid] : null, () => fetchWikipediaSummary(mb.data?.relations));

  const name = meta.data?.name ?? mb.data?.name ?? "";
  const recordings = React.useMemo(() => (topRecs.data ?? []).slice(0, 10), [topRecs.data]);
  const popularListens = React.useMemo(() => recordings.map(popularRecordingToListen), [recordings]);

  const playsByRG = React.useMemo(() => {
    const m = new Map<string, number>();
    (topRGs.data ?? []).forEach((r) => m.set(r.release_group_mbid, r.total_listen_count));
    return m;
  }, [topRGs.data]);

  const groups = React.useMemo(() => {
    const out: Record<GroupKey, ArtistReleaseGroup[]> = { Album: [], EP: [], Single: [], Other: [] };
    const seen = new Set<string>();
    for (const rg of meta.data?.release_group ?? []) {
      if (seen.has(rg.mbid)) continue;
      seen.add(rg.mbid);
      out[groupOf(rg)].push(rg);
    }
    for (const key of GROUP_ORDER) {
      out[key].sort(
        (a, b) =>
          (b.date ?? "").localeCompare(a.date ?? "") ||
          (playsByRG.get(b.mbid) ?? 0) - (playsByRG.get(a.mbid) ?? 0) ||
          a.name.localeCompare(b.name)
      );
    }
    return out;
  }, [meta.data, playsByRG]);

  // Which group is expanded, keyed by artist so it resets when the artist changes.
  const [expandedGroup, setExpandedGroup] = React.useState<string | null>(null);

  // Tags: MusicBrainz genres first (by count), then ListenBrainz tags not already listed.
  const tags = React.useMemo(() => {
    const genres = [...(mb.data?.genres ?? [])].sort((a, b) => b.count - a.count).map((g) => ({ name: g.name }));
    const seen = new Set(genres.map((g) => g.name.toLowerCase()));
    const lbTags = [...(meta.data?.tag?.artist ?? [])]
      .sort((a, b) => b.count - a.count)
      .filter((t) => {
        const k = t.tag.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((t) => ({ name: t.tag }));
    return [...genres, ...lbTags];
  }, [mb.data, meta.data]);

  const notFound = meta.data === null && !meta.isLoading;
  const headerLoading = meta.isLoading && !meta.data;

  const area = mb.data?.area?.name ?? mb.data?.country ?? undefined;
  const type = mb.data?.type ?? meta.data?.type ?? undefined;
  const life = mb.data ? lifeSpan(mb.data["life-span"]?.begin, mb.data["life-span"]?.end, mb.data["life-span"]?.ended) : undefined;
  const begin = meta.data?.begin_year;

  return (
    <div className="flex flex-col gap-[14px] pb-2 pt-6">
      {meta.error ? (
        <ErrorNote error={meta.error} onRetry={() => meta.mutate()} />
      ) : notFound ? (
        <Empty>We couldn&apos;t find this artist on ListenBrainz.</Empty>
      ) : headerLoading ? (
        <section className="rounded-[20px] bg-card p-[22px]">
          <SkeletonRows rows={1} cover={false} pitch={96} />
        </section>
      ) : (
        <EntityHeader
          cover={<CoverArt alt={name} size={96} rounded={10} />}
          title={name}
          meta={[
            type,
            area,
            life ?? (begin ? `${begin}–` : undefined),
          ]}
          tags={tags.length ? <TagPills tags={tags} /> : undefined}
          actions={
            <>
              <Button
                isDisabled={!popularListens.length}
                onPress={() => player.playQueue(popularListens, 0)}
              >
                Play all
              </Button>
              <ButtonLink href={`/explore/lb-radio?prompt=artist:(${mbid})&mode=easy`} variant="secondary">
                LB Radio
              </ButtonLink>
              <ButtonLink href={`${MB_URL}/artist/${mbid}`} external variant="tertiary">
                Open in MusicBrainz
              </ButtonLink>
              <ButtonLink href={`${LB_WEB_URL}/artist/${mbid}/`} external variant="tertiary">
                ListenBrainz page
              </ButtonLink>
            </>
          }
        />
      )}

      <div className="grid gap-[14px] lg:grid-cols-6">
        <Panel title="Popular tracks" className="lg:col-span-4" bodyClassName="-mx-2">
          {topRecs.isLoading ? (
            <SkeletonRows rows={6} />
          ) : topRecs.error ? (
            <ErrorNote error={topRecs.error} onRetry={() => topRecs.mutate()} />
          ) : !popularListens.length ? (
            <Empty>Popular tracks appear once people have listened to this artist&apos;s recordings.</Empty>
          ) : (
            <ListenRows
              listens={popularListens}
              meta={(_, i) => playsLabel(recordings[i]?.total_listen_count)}
            />
          )}
        </Panel>

        <Panel title="Top listeners" className="lg:col-span-2">
          {listeners.isLoading ? (
            <SkeletonRows rows={5} cover={false} pitch={44} />
          ) : listeners.error ? (
            <ErrorNote error={listeners.error} onRetry={() => listeners.mutate()} />
          ) : !listeners.data ? (
            <Empty>Listener stats for this artist aren&apos;t calculated yet.</Empty>
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

        <Panel title="Discography" className="lg:col-span-6">
          {meta.isLoading ? (
            <SkeletonRows rows={4} cover={false} pitch={48} />
          ) : meta.error ? (
            <ErrorNote error={meta.error} onRetry={() => meta.mutate()} />
          ) : !meta.data ? null : !meta.data.release_group.length ? (
            <Empty>No releases are linked to this artist on MusicBrainz yet.</Empty>
          ) : (
            <div className="flex flex-col gap-6">
              {GROUP_ORDER.filter((k) => groups[k].length).map((k) => {
                const all = groups[k];
                const expanded = expandedGroup === `${mbid}:${k}`;
                const shown = expanded ? all : all.slice(0, GROUP_LIMIT);
                return (
                  <div key={k}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-[13px] font-medium text-ink-2">
                        {k === "Other" ? "Other releases" : `${k}s`} <span className="num text-ink-3">{fmtInt(all.length)}</span>
                      </h3>
                      {all.length > GROUP_LIMIT ? (
                        <Button size="sm" variant="tertiary" onPress={() => setExpandedGroup(expanded ? null : `${mbid}:${k}`)}>
                          {expanded ? "Show fewer" : `Show all ${fmtInt(all.length)}`}
                        </Button>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-[14px]">
                      {shown.map((rg) => {
                        const plays = playsByRG.get(rg.mbid);
                        const year = yearOf(rg.date);
                        const sub = [year, rg.secondary_types?.length ? rg.secondary_types.join(", ") : undefined, plays ? `${fmtInt(plays)} plays` : undefined]
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          <ReleaseTile
                            key={rg.mbid}
                            href={`/album/${rg.mbid}`}
                            src={caaCover(rg.caa_release_mbid, rg.caa_id) ?? releaseGroupCover(rg.mbid)}
                            alt={rg.name}
                            title={rg.name}
                            meta={sub || undefined}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Similar artists" className="lg:col-span-2">
          {similar.isLoading ? (
            <SkeletonRows rows={5} cover={false} pitch={44} />
          ) : similar.error ? (
            <ErrorNote error={similar.error} onRetry={() => similar.mutate()} />
          ) : !similar.data?.length ? (
            <Empty>Similar artists appear once enough people have listened to this artist.</Empty>
          ) : (
            <ul className="flex flex-col">
              {similar.data.slice(0, 8).map((a) => (
                <li key={a.artist_mbid} className="min-w-0 py-1.5">
                  <Link href={`/artist/${a.artist_mbid}`} className="block truncate text-[14px] font-medium">
                    {a.name}
                  </Link>
                  {a.type || a.comment ? (
                    <div className="truncate text-[12px] text-ink-3">{[a.type, a.comment].filter(Boolean).join(" · ")}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="About" className="lg:col-span-4">
          {mb.error ? (
            <ErrorNote error={mb.error} onRetry={() => mb.mutate()} />
          ) : mb.isLoading || (mb.data && wiki.isLoading) ? (
            <SkeletonRows rows={3} cover={false} pitch={28} />
          ) : wiki.error ? (
            <ErrorNote error={wiki.error} onRetry={() => wiki.mutate()} />
          ) : !wiki.data ? (
            <Empty>No Wikipedia article is linked to this artist on MusicBrainz.</Empty>
          ) : (
            <div>
              <p className="line-clamp-6 text-[14px] leading-6 text-ink-2">{wiki.data.extract}</p>
              <a
                href={wiki.data.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cx("mt-3 inline-block text-[13px] text-ink-2 transition-colors hover:text-data")}
              >
                Read more
              </a>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

