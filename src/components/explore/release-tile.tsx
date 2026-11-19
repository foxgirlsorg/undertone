"use client";

import * as React from "react";
import NextLink from "next/link";
import { Play } from "@gravity-ui/icons";
import { Pill } from "@/components/ui";
import { caaCover, releaseCover } from "@/lib/listen";
import { fmtCompact } from "@/lib/format";

export type ReleaseTileProps = {
  release: FreshReleaseItem;
  /** Date line under the title, for flat grids that have no date heading. */
  dateLabel?: string;
};

/** One release in a cover grid: cover, play button, title, artist, type pill and listen count. */
export function ReleaseTile({ release, dateLabel }: ReleaseTileProps) {
  const cover = caaCover(release.caa_release_mbid, release.caa_id, 250) ?? releaseCover(release.release_mbid, 250);
  // Remember which cover failed; a new cover URL is tried again without any effect.
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const failed = !!cover && failedSrc === cover;
  const albumHref = `/album/${release.release_group_mbid}`;
  const type = release.release_group_primary_type ?? release.release_group_secondary_type ?? null;
  const alt = `${release.release_name} by ${release.artist_credit_name}`;

  return (
    <article className="flex min-w-0 flex-col gap-2">
      <div className="group relative aspect-square w-full overflow-hidden rounded-[10px] bg-raised">
        <NextLink href={albumHref} aria-label={`Open ${alt}`} className="block size-full">
          {cover && !failed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={alt} loading="lazy" onError={() => setFailedSrc(cover)} className="size-full object-cover" />
          ) : (
            <span aria-hidden className="flex size-full items-center justify-center text-[13px] text-ink-3">
              {release.artist_credit_name.slice(0, 1).toUpperCase() || "—"}
            </span>
          )}
        </NextLink>
        <NextLink
          href={`/player/release/${release.release_mbid}`}
          aria-label={`Play ${release.release_name}`}
          className="absolute bottom-2 right-2 flex size-10 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 focus-visible:scale-105"
        >
          <Play className="size-4" />
        </NextLink>
      </div>
      <div className="min-w-0">
        <NextLink href={albumHref} className="block truncate text-[14px] font-medium leading-5 hover:text-data">
          {release.release_name}
        </NextLink>
        <div className="truncate text-[13px] leading-5 text-ink-2">{release.artist_credit_name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
          {type ? <Pill>{type}</Pill> : null}
          {dateLabel ? <span>{dateLabel}</span> : null}
          {release.listen_count ? <span className="num">{fmtCompact(release.listen_count)} listens</span> : null}
        </div>
      </div>
    </article>
  );
}
