"use client";

/* Stats hooks and small helpers shared by the stats screens (user and sitewide). */

import countries from "i18n-iso-countries";
import countriesEn from "i18n-iso-countries/langs/en.json";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { STATS_RANGES } from "@/lib/format";
import { errorStatus, useLB } from "@/lib/use-lb";
import { caaCover, releaseGroupCover } from "@/lib/listen";

export type Scope = { user?: string; range: UserStatsAPIRange };
export type TopEntity = "artist" | "release-group" | "recording";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Where a stats screen lives: the user's stats or the sitewide statistics. */
export const statsBase = (user?: string) => (user ? `/user/${encodeURIComponent(user)}/stats` : "/statistics");

export const isStatsRange = (v: string | null | undefined): v is UserStatsAPIRange =>
  !!v && STATS_RANGES.some((r) => r.key === v);

/** The words used on screen for a range, e.g. "Last week". */
export const rangeLabel = (range: UserStatsAPIRange) => STATS_RANGES.find((r) => r.key === range)?.label ?? range;

/** `?range=` as state. Setting it keeps the other params and resets `page`. */
export function useStatsRange(fallback: UserStatsAPIRange): [UserStatsAPIRange, (r: UserStatsAPIRange) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get("range");
  const range: UserStatsAPIRange = isStatsRange(raw) ? raw : fallback;
  const setRange = React.useCallback(
    (next: UserStatsAPIRange) => {
      const p = new URLSearchParams(params.toString());
      p.set("range", next);
      p.delete("page");
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [params, pathname, router]
  );
  return [range, setRange];
}

/** `?page=` as state, 1-based. */
export function usePageParam(): [number, (page: number) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "", 10) || 1);
  const setPage = React.useCallback(
    (next: number) => {
      const p = new URLSearchParams(params.toString());
      if (next <= 1) p.delete("page");
      else p.set("page", String(next));
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [params, pathname, router]
  );
  return [page, setPage];
}

/** The API answers 204 (or 404) when the period has not been calculated yet. */
export function isNotCalculated(err: unknown): boolean {
  const status = errorStatus(err);
  return status === 204 || status === 404;
}

/** Top-N entity stats (artists, release groups or recordings). `count` is the page size. */
export function useTopEntity(user: string | undefined, entity: TopEntity, range: UserStatsAPIRange, offset = 0, count = 5) {
  return useLB(["stats-entity", user ?? "sitewide", entity, range, offset, count], (api) =>
    api.getUserEntity(user, entity, range, offset, count)
  );
}

export const artistsOf = (d: UserEntityResponse) => (d as UserArtistsResponse).payload.artists ?? [];
export const albumsOf = (d: UserEntityResponse) => (d as UserReleaseGroupsResponse).payload.release_groups ?? [];
export const tracksOf = (d: UserEntityResponse) => (d as UserRecordingsResponse).payload.recordings ?? [];

export type RecordingEntity = UserRecordingsResponse["payload"]["recordings"][number];

/** A Listen built from a top-recordings row, so ListenCard can play, love and queue it. */
export function recordingToListen(r: RecordingEntity): Listen {
  return {
    listened_at: 0,
    track_metadata: {
      artist_name: r.artist_name,
      track_name: r.track_name,
      release_name: r.release_name,
      mbid_mapping: r.recording_mbid
        ? {
            recording_mbid: r.recording_mbid,
            release_mbid: r.release_mbid ?? "",
            artist_mbids: r.artist_mbids ?? [],
            artists: r.artists,
            caa_id: r.caa_id,
            caa_release_mbid: r.caa_release_mbid,
          }
        : undefined,
    },
  };
}

export type ReleaseGroupEntity = UserReleaseGroupsResponse["payload"]["release_groups"][number];

/** Cover for a release-group row: the release's own CAA image first, then the release-group front. */
export const albumCover = (a: ReleaseGroupEntity) =>
  caaCover(a.caa_release_mbid, a.caa_id) ?? releaseGroupCover(a.release_group_mbid);

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

countries.registerLocale(countriesEn);

/** "GBR" / "GB" → "United Kingdom". ListenBrainz's artist map uses ISO alpha-3 codes. */
export function countryName(code: string): string {
  const alpha2 = code.length === 3 ? countries.alpha3ToAlpha2(code.toUpperCase()) : code.toUpperCase();
  if (!alpha2) return code;
  try {
    return regionNames?.of(alpha2) ?? countries.getName(alpha2, "en") ?? code;
  } catch {
    return countries.getName(alpha2, "en") ?? code;
  }
}
