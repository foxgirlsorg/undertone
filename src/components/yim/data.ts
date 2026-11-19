"use client";

/*
  Year in Music data layer.
  - 2024 and later: GET /1/stats/user/{u}/year-in-music/{year} (current pipeline).
  - 2021 to 2023: GET /1/stats/user/{u}/year-in-music/legacy/{year} (archived payloads).
  Each year has its own shape, so everything is normalised into one YimReport. Missing fields stay
  undefined and the sections that need them simply do not render.
*/

import type APIService from "@/lib/api";
import { useLB } from "@/lib/use-lb";
import { caaCover, releaseCover, releaseGroupCover, jspfTrackToListen } from "@/lib/listen";

export const YIM_FIRST_YEAR = 2021;
/** The year before the current calendar year: reports are generated once a year has ended. */
export const YIM_LATEST_YEAR = new Date().getFullYear() - 1;
export const YIM_YEARS = Array.from(
  { length: YIM_LATEST_YEAR - YIM_FIRST_YEAR + 1 },
  (_, i) => YIM_FIRST_YEAR + i
);
export const isYimYear = (year: number) =>
  Number.isInteger(year) && year >= YIM_FIRST_YEAR && year <= YIM_LATEST_YEAR;

/* ---------- raw payload shapes (only the fields we read) ---------- */

type RawTrack = {
  track_name: string;
  artist_name: string;
  release_name?: string;
  release_mbid?: string | null;
  recording_mbid?: string;
  listen_count: number;
  artist_mbids?: string[];
  artists?: MBIDMappingArtist[];
  caa_id?: number | null;
  caa_release_mbid?: string | null;
};

type RawRelease = {
  release_name?: string;
  release_group_name?: string;
  release_mbid?: string;
  release_group_mbid?: string;
  artist_name: string;
  artist_mbids?: string[];
  listen_count: number;
  caa_id?: number | null;
  caa_release_mbid?: string | null;
};

type RawPlaylistTrack = Omit<JSPFTrack, "identifier"> & { identifier?: string | string[] };

type RawPlaylist = {
  title?: string;
  identifier?: string;
  mbid?: string;
  track?: RawPlaylistTrack[];
  jspf?: { playlist?: RawPlaylist };
};

type RawData = {
  day_of_week?: string;
  top_artists?: Array<{ artist_name: string; artist_mbid?: string; artist_mbids?: string[]; listen_count: number }>;
  top_genres?: Array<{ genre: string; genre_count_percent: number }>;
  top_release_groups?: RawRelease[];
  top_releases?: RawRelease[];
  top_releases_coverart?: Record<string, string>;
  top_recordings?: RawTrack[];
  listens_per_day?: Array<{ from_ts: number; listen_count: number }>;
  similar_users?: Record<string, number>;
  total_listen_count?: number;
  total_new_artists_discovered?: number;
  total_listening_time?: number; // seconds
  [key: string]: unknown; // playlist-* keys
};

type RawResponse = { data: RawData; year: number };

/* ---------- normalised report ---------- */

export type YimArtist = { key: string; name: string; mbid?: string; count: number };
export type YimAlbum = { key: string; title: string; artist: string; count: number; href?: string; cover?: string };
export type YimTrack = { listen: Listen; count: number };
export type YimDay = { ts: number; count: number };
export type YimPlaylist = {
  key: string;
  label: string;
  description: string;
  title: string;
  mbid?: string;
  tracks: Listen[];
};

export type YimReport = {
  year: number;
  listens?: number;
  newArtists?: number;
  listeningSeconds?: number;
  dayOfWeek?: string;
  artists: YimArtist[];
  albums: YimAlbum[];
  tracks: YimTrack[];
  days: YimDay[];
  similar: Array<{ name: string; score: number }>;
  genres: Array<{ name: string; percent: number }>;
  playlists: YimPlaylist[];
};

/** Playlists in the order the report reads them; anything else follows in payload order. */
const PLAYLIST_ORDER: Record<string, { label: string; description: string }> = {
  "playlist-top-discoveries-for-year": {
    label: "Top discoveries",
    description: "Recordings you first listened to this year and played more than once.",
  },
  "playlist-top-missed-recordings-for-year": {
    label: "Missed recordings",
    description: "Favorites of your most similar users that you have not played this year.",
  },
  "playlist-top-recordings-for-year": {
    label: "Top recordings",
    description: "Made from your top recordings of the year.",
  },
  "playlist-top-new-recordings-for-year": {
    label: "New recordings",
    description: "Recordings released this year that you listened to the most.",
  },
};

/* ---------- fetching ---------- */

/** Returns null when the report does not exist (204 not calculated, 404 unknown user or year). */
async function fetchRaw(api: APIService, username: string, year: number): Promise<RawResponse | null> {
  const legacy = year < 2024 ? "legacy/" : "";
  const url = `${api.APIBaseURI}/stats/user/${encodeURIComponent(username)}/year-in-music/${legacy}${year}`;
  const res = await fetch(url);
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) {
    const err = new Error(`The server answered ${res.status}.`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const json = (await res.json()) as { payload?: { data?: RawData } };
  const data = json?.payload?.data;
  if (!data || Object.keys(data).length === 0) return null;
  return { data, year };
}

/* ---------- normalisation ---------- */

const toTrackListen = (t: RawTrack): Listen => {
  const recording = t.recording_mbid ?? undefined;
  const release = t.release_mbid ?? undefined;
  return {
    listened_at: 0,
    track_metadata: {
      track_name: t.track_name,
      artist_name: t.artist_name,
      release_name: t.release_name,
      release_mbid: release,
      recording_mbid: recording,
      additional_info: {
        recording_mbid: recording,
        release_mbid: release,
        artist_mbids: t.artist_mbids,
      } as AdditionalInfo,
      mbid_mapping: {
        recording_mbid: recording ?? "",
        release_mbid: release ?? "",
        artist_mbids: t.artist_mbids ?? [],
        artists: t.artists,
        caa_id: t.caa_id ?? undefined,
        caa_release_mbid: t.caa_release_mbid ?? undefined,
      } as MBIDMapping,
    },
  };
};

/** Legacy 2021 and 2022 playlists sometimes give `identifier` as a string; the helper wants an array. */
const toPlaylistTrack = (t: RawPlaylistTrack): Listen => {
  const identifier = Array.isArray(t.identifier) ? t.identifier : t.identifier ? [t.identifier] : [];
  return jspfTrackToListen({ ...t, identifier } as unknown as JSPFTrack);
};

function normalize({ data: d, year }: RawResponse): YimReport {
  const artists: YimArtist[] = (d.top_artists ?? []).slice(0, 10).map((a) => {
    const mbid = a.artist_mbid ?? a.artist_mbids?.[0];
    return { key: mbid ?? a.artist_name, name: a.artist_name, mbid, count: a.listen_count };
  });

  let albums: YimAlbum[] = [];
  if (d.top_release_groups?.length) {
    albums = d.top_release_groups.slice(0, 10).map((rg) => {
      const mbid = rg.release_group_mbid;
      return {
        key: mbid ?? rg.release_group_name ?? "",
        title: rg.release_group_name ?? "",
        artist: rg.artist_name,
        count: rg.listen_count,
        href: mbid ? `/album/${mbid}` : undefined,
        cover: caaCover(rg.caa_release_mbid, rg.caa_id) ?? releaseGroupCover(mbid),
      };
    });
  } else if (d.top_releases?.length) {
    albums = d.top_releases.slice(0, 10).map((r) => {
      const mbid = r.release_mbid;
      return {
        key: mbid ?? r.release_name ?? "",
        title: r.release_name ?? "",
        artist: r.artist_name,
        count: r.listen_count,
        href: mbid ? `/release/${mbid}` : undefined,
        cover:
          caaCover(r.caa_release_mbid, r.caa_id) ??
          (mbid ? d.top_releases_coverart?.[mbid] : undefined) ??
          releaseCover(mbid),
      };
    });
  }

  const tracks: YimTrack[] = (d.top_recordings ?? []).slice(0, 10).map((t) => ({
    listen: toTrackListen(t),
    count: t.listen_count,
  }));

  const days: YimDay[] = (d.listens_per_day ?? []).map((x) => ({ ts: x.from_ts, count: x.listen_count }));

  const similar = Object.entries(d.similar_users ?? {})
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const genres = (d.top_genres ?? [])
    .slice(0, 10)
    .map((g) => ({ name: g.genre, percent: g.genre_count_percent }));

  const playlistKeys = Object.keys(d)
    .filter((k) => k.startsWith("playlist-") && !k.endsWith("-coverart"))
    .sort((a, b) => {
      const ia = Object.keys(PLAYLIST_ORDER).indexOf(a);
      const ib = Object.keys(PLAYLIST_ORDER).indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  const playlists: YimPlaylist[] = [];
  for (const key of playlistKeys) {
    const raw = d[key] as RawPlaylist | undefined;
    if (!raw) continue;
    const pl = raw.jspf?.playlist ?? raw;
    const tracks = (pl.track ?? []).map(toPlaylistTrack);
    if (!tracks.length) continue;
    const mbid = raw.mbid ?? pl.identifier?.split("/").filter(Boolean).pop();
    const meta = PLAYLIST_ORDER[key];
    playlists.push({
      key,
      label: meta?.label ?? pl.title ?? key,
      description: meta?.description ?? "",
      title: pl.title ?? key,
      mbid,
      tracks,
    });
  }

  return {
    year,
    listens: d.total_listen_count,
    newArtists: d.total_new_artists_discovered,
    listeningSeconds: d.total_listening_time,
    dayOfWeek: d.day_of_week,
    artists,
    albums,
    tracks,
    days,
    similar,
    genres,
    playlists,
  };
}

/** True when the report has at least one thing to show. */
export function hasReportContent(r: YimReport) {
  return (
    r.listens != null ||
    r.artists.length > 0 ||
    r.albums.length > 0 ||
    r.tracks.length > 0 ||
    r.days.length > 0 ||
    r.similar.length > 0 ||
    r.genres.length > 0 ||
    r.playlists.length > 0
  );
}

/* ---------- hooks ---------- */

/** One year's report for a user. `null` means there is no report for that year. */
export function useYearReport(username: string, year: number, initial?: YimReport | null) {
  // Only reuse a preloaded report for the same year, or SWR would show the wrong year while loading.
  const fallback = initial && initial.year === year ? initial : undefined;
  return useLB(
    isYimYear(year) ? ["yim", username, year] : null,
    async (api) => {
      const raw = await fetchRaw(api, username, year);
      return raw ? normalize(raw) : null;
    },
    fallback ? { fallbackData: fallback, revalidateOnMount: false } : undefined
  );
}

/** Newest year that has a report, probing from the latest year down to 2021. */
export function useLatestYear(username: string) {
  return useLB(["yim-latest", username], async (api) => {
    for (let y = YIM_LATEST_YEAR; y >= YIM_FIRST_YEAR; y -= 1) {
      const raw = await fetchRaw(api, username, y);
      if (raw) return { year: y, report: normalize(raw) };
    }
    return null;
  });
}

/** URL of the shareable cover image for a user's year (SVG). */
export const yimArtUrl = (api: APIService, username: string, year: number) =>
  `${api.APIBaseURI}/art/year-in-music/${year}/${encodeURIComponent(username)}?image=overview`;
