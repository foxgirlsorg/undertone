"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Button } from "@heroui/react";
import { LB_WEB_URL, MB_URL } from "@/lib/config";
import { useLB } from "@/lib/use-lb";
import { fmtDateLong, fmtDuration, fmtInt } from "@/lib/format";
import { caaCover, releaseCover } from "@/lib/listen";
import { CoverArt, Empty, ErrorNote, Link, Panel, SkeletonRows } from "@/components/ui";
import { ButtonLink, EntityHeader, ListenRows, StatBlock, TagPills } from "@/components/entity/entity-parts";
import { mbQueued, creditName, creditsToRefs } from "@/components/entity/mb";
import {
  fetchRecordingMetadata,
  fetchRecordingPopularity,
  mbRecordingToListen,
} from "@/components/entity/data";
import { usePlayer } from "@/components/player/player-context";

type RecordingWithReleases = MusicBrainzRecording & {
  releases?: Array<MusicBrainzRelease & WithReleaseGroup & Partial<WithMedia>>;
};

const prettyDate = (d?: string) => (!d ? undefined : d.length === 10 ? fmtDateLong(d) : d);
const RELEASES_LIMIT = 10;

export default function TrackPage() {
  const { trackMBID } = useParams<{ trackMBID: string }>();
  const mbid = decodeURIComponent(trackMBID);
  const player = usePlayer();
  const [showAllFor, setShowAllFor] = React.useState<string | null>(null);
  const showAll = showAllFor === mbid;
  const setShowAll = (open: boolean) => setShowAllFor(open ? mbid : null);

  const rec = useLB(["track-mb", mbid], (api) =>
    mbQueued(() => api.lookupMBRecording(mbid, "artists+releases+release-groups")) as Promise<RecordingWithReleases>
  );
  const meta = useLB(["track-meta", mbid], () => fetchRecordingMetadata(mbid));
  const pop = useLB(["track-popularity", mbid], () => fetchRecordingPopularity(mbid));

  const credit = React.useMemo(() => creditsToRefs(rec.data?.["artist-credit"]), [rec.data]);
  const artistLine = creditName(credit);
  const title = rec.data?.title ?? meta.data?.recording?.name ?? "";

  // Releases this recording appears on, earliest first.
  const releases = React.useMemo(
    () =>
      [...(rec.data?.releases ?? [])].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")),
    [rec.data]
  );
  // The header shows the release ListenBrainz links this recording to; otherwise the earliest one.
  const headerRelease = React.useMemo(() => {
    const lbRelease = meta.data?.release;
    if (lbRelease?.mbid) {
      return { id: lbRelease.mbid, title: lbRelease.name ?? "", "release-group": lbRelease.release_group_mbid ? { id: lbRelease.release_group_mbid } : undefined };
    }
    const first = releases[0];
    return first ? { id: first.id, title: first.title, "release-group": first["release-group"] } : undefined;
  }, [meta.data, releases]);

  const listen = React.useMemo(
    () =>
      rec.data
        ? mbRecordingToListen(
            { id: mbid, title: rec.data.title, length: rec.data.length, "artist-credit": rec.data["artist-credit"] },
            headerRelease
          )
        : null,
    [rec.data, mbid, headerRelease]
  );

  const coverSrc =
    caaCover(meta.data?.release?.caa_release_mbid, meta.data?.release?.caa_id, 250) ??
    releaseCover(headerRelease?.id, 250);

  const tags = React.useMemo(
    () =>
      [...(meta.data?.tag?.recording ?? [])].sort((a, b) => b.count - a.count).map((t) => ({ name: t.tag })),
    [meta.data]
  );

  const firstDate = rec.data?.["first-release-date"] || meta.data?.recording?.first_release_date;
  const length = rec.data?.length ?? meta.data?.recording?.length;
  const hasListens = !!pop.data && pop.data.total_listen_count > 0;

  return (
    <div className="flex flex-col gap-[14px] pb-2 pt-6">
      {rec.error && !rec.data ? (
        <ErrorNote error={rec.error} onRetry={() => rec.mutate()} />
      ) : rec.isLoading && !rec.data ? (
        <section className="rounded-[20px] bg-card p-[22px]">
          <SkeletonRows rows={1} cover={false} pitch={96} />
        </section>
      ) : rec.data ? (
        <EntityHeader
          cover={<CoverArt src={coverSrc} alt={headerRelease?.title || title} size={160} rounded={8} />}
          title={title}
          credit={
            credit.length ? (
              <>
                {credit.map((c, i) => (
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
          meta={[
            length ? fmtDuration(length) : undefined,
            headerRelease?.title || undefined,
            prettyDate(firstDate) ? `First released ${prettyDate(firstDate)}` : undefined,
          ]}
          tags={tags.length ? <TagPills tags={tags} /> : undefined}
          actions={
            <>
              <Button onPress={() => listen && player.playListen(listen)} isDisabled={!listen}>
                Play
              </Button>
              <ButtonLink href={`${MB_URL}/recording/${mbid}`} external variant="tertiary">
                Open in MusicBrainz
              </ButtonLink>
              <ButtonLink href={`${LB_WEB_URL}/track/${mbid}/`} external variant="tertiary">
                ListenBrainz page
              </ButtonLink>
            </>
          }
        />
      ) : null}

      {listen ? (
        <Panel bodyClassName="-mx-2">
          <ListenRows
            listens={[listen]}
            meta={() => (hasListens ? `${fmtInt(pop.data?.total_listen_count)} plays` : "No plays yet")}
          />
        </Panel>
      ) : null}

      <div className="grid gap-[14px] lg:grid-cols-6">
        <Panel title="Listens" className="lg:col-span-2">
          {pop.isLoading ? (
            <SkeletonRows rows={2} cover={false} pitch={56} />
          ) : pop.error ? (
            <ErrorNote error={pop.error} onRetry={() => pop.mutate()} />
          ) : !pop.data ? (
            <Empty>No listens of this recording are recorded yet.</Empty>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <StatBlock label="Listens" value={fmtInt(pop.data.total_listen_count)} />
              <StatBlock label="Listeners" value={fmtInt(pop.data.total_user_count)} />
            </div>
          )}
        </Panel>

        <Panel title="Appears on" className="lg:col-span-4">
          {rec.isLoading ? (
            <SkeletonRows rows={4} pitch={56} />
          ) : rec.error ? (
            <ErrorNote error={rec.error} onRetry={() => rec.mutate()} />
          ) : !releases.length ? (
            <Empty>MusicBrainz lists no releases for this recording.</Empty>
          ) : (
            <>
              <ul className="flex flex-col">
                {(showAll ? releases : releases.slice(0, RELEASES_LIMIT)).map((r) => {
                  const rgId = r["release-group"]?.id;
                  const formats = (r.media ?? []).map((m) => m.format).filter(Boolean);
                  const detail = [prettyDate(r.date), r.country, formats.length ? formats.join(", ") : undefined]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li key={r.id} className="flex items-center gap-3 py-1.5">
                      <CoverArt src={releaseCover(r.id, 250)} alt={r.title} size={40} />
                      <div className="min-w-0 flex-1">
                        <Link href={rgId ? `/album/${rgId}` : `/release/${r.id}`} className="block truncate text-[14px] font-medium">
                          {r.title}
                        </Link>
                        <div className="truncate text-[12px] text-ink-3">{detail}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {releases.length > RELEASES_LIMIT ? (
                <div className="mt-2">
                  <Button size="sm" variant="tertiary" onPress={() => setShowAll(!showAll)}>
                    {showAll ? "Show fewer" : `Show all ${fmtInt(releases.length)}`}
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
