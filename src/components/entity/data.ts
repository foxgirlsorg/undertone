/*
  Data for entity pages (artist, release group, recording) rebuilt from public endpoints.
  The official site fetches these through one server-only POST; here each piece is its own call.
*/

import { CAA_URL, LB_API_URL } from "@/lib/config";
import { HttpError, mbGet, creditsToRefs, type CreditRef } from "./mb";

export const LB_BASE = `${LB_API_URL.replace(/\/$/, "")}/1`;

/** Similar artists come from the labs service with the algorithm the official Music Neighborhood uses. */
export const SIMILAR_ALGORITHM =
  "session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30";

/** GET a ListenBrainz endpoint. `nullOn` statuses resolve to null (e.g. stats not calculated yet). */
export async function lbGet<T>(url: string, nullOn: number[] = [204, 404]): Promise<T | null> {
  const res = await fetch(url);
  if (nullOn.includes(res.status)) return null;
  if (!res.ok) throw new HttpError(res.status, `ListenBrainz ${res.status}`);
  return (await res.json()) as T;
}

/* ───────── Artist ───────── */

export type ArtistMetadata = {
  artist_mbid: string;
  name: string;
  type?: string;
  area?: string;
  begin_year?: number;
  end_year?: number;
  tag?: { artist?: ArtistTag[] };
  release_group: ArtistReleaseGroup[];
};

export type ArtistReleaseGroup = {
  mbid: string;
  name: string;
  type: string;
  secondary_types?: string[];
  date?: string;
  caa_id?: number;
  caa_release_mbid?: string;
  artists?: MBIDMappingArtist[];
  artist_credit_name?: string;
};

export type PopularRecording = RecordingType;
export type PopularReleaseGroup = ReleaseGroupType;

export type ListenersPayload = {
  listeners: Array<{ user_name: string; listen_count: number }>;
  total_listen_count: number;
  total_user_count: number;
  from_ts?: number;
  to_ts?: number;
};

export type SimilarArtist = ArtistNodeInfo;

/** metadata/artist returns an array with one object per requested MBID. */
export async function fetchArtistMetadata(mbid: string): Promise<ArtistMetadata | null> {
  const rows = await lbGet<ArtistMetadata[]>(
    `${LB_BASE}/metadata/artist/?artist_mbids=${encodeURIComponent(mbid)}&inc=artist%20tag%20release_group`,
    []
  );
  return rows?.[0] ?? null;
}

export const fetchTopRecordingsForArtist = (mbid: string) =>
  lbGet<PopularRecording[]>(`${LB_BASE}/popularity/top-recordings-for-artist/${mbid}`, []);

export const fetchTopReleaseGroupsForArtist = (mbid: string) =>
  lbGet<PopularReleaseGroup[]>(`${LB_BASE}/popularity/top-release-groups-for-artist/${mbid}`, []);

type ListenersResponse = { payload: ListenersPayload & { artist_mbid?: string; release_group_mbid?: string } };

export async function fetchArtistListeners(mbid: string): Promise<ListenersPayload | null> {
  const res = await lbGet<ListenersResponse>(`${LB_BASE}/stats/artist/${mbid}/listeners?range=all_time`);
  return res?.payload ?? null;
}

export async function fetchReleaseGroupListeners(mbid: string): Promise<ListenersPayload | null> {
  const res = await lbGet<ListenersResponse>(`${LB_BASE}/stats/release-group/${mbid}/listeners?range=all_time`);
  return res?.payload ?? null;
}

/** The labs similar-artists service, public and without a token. */
export async function fetchSimilarArtists(mbid: string): Promise<SimilarArtist[]> {
  const url = `https://labs.api.listenbrainz.org/similar-artists/json?algorithm=${encodeURIComponent(
    SIMILAR_ALGORITHM
  )}&artist_mbids=${encodeURIComponent(mbid)}`;
  const res = await fetch(url);
  if (res.status === 204 || res.status === 404) return [];
  if (!res.ok) throw new HttpError(res.status, `Similar artists ${res.status}`);
  return (await res.json()) as SimilarArtist[];
}

/* MusicBrainz artist with url-rels, genres and life-span (one MB request). */
export type MBArtistDetail = {
  id: string;
  name: string;
  type?: string | null;
  disambiguation?: string;
  country?: string | null;
  area?: { name: string } | null;
  "life-span"?: { begin?: string | null; end?: string | null; ended?: boolean };
  genres?: Array<{ name: string; count: number }>;
  relations?: Array<{ type: string; url?: { resource: string } }>;
};

export const fetchMBArtistDetail = (mbid: string) =>
  mbGet<MBArtistDetail>(`artist/${mbid}`, { inc: "url-rels+genres" });

/** Wikipedia summary for an artist, reached through a Wikipedia or Wikidata url-rel. */
export type WikiSummary = { extract: string; url: string; title: string };

export async function fetchWikipediaSummary(relations: MBArtistDetail["relations"]): Promise<WikiSummary | null> {
  const direct = relations?.find((r) => r.type === "wikipedia")?.url?.resource;
  let lang = "en";
  let title: string | undefined;
  if (direct) {
    const m = direct.match(/^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/(.+)$/);
    if (m) {
      lang = m[1];
      title = decodeURIComponent(m[2]);
    }
  }
  if (!title) {
    const qid = relations?.find((r) => r.type === "wikidata")?.url?.resource?.split("/").pop();
    if (!qid) return null;
    const wd = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=sitelinks&sitefilter=enwiki&format=json&origin=*`
    );
    if (!wd.ok) throw new HttpError(wd.status, `Wikidata ${wd.status}`);
    const body = (await wd.json()) as { entities?: Record<string, { sitelinks?: Record<string, { title: string }> }> };
    title = body.entities?.[qid]?.sitelinks?.enwiki?.title;
    if (!title) return null;
  }
  const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(res.status, `Wikipedia ${res.status}`);
  const body = (await res.json()) as {
    extract?: string;
    title?: string;
    content_urls?: { desktop?: { page?: string } };
  };
  if (!body.extract) return null;
  return {
    extract: body.extract,
    title: body.title ?? title,
    url: body.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
  };
}

/* ───────── Release group ───────── */

export type ReleaseGroupMetadata = {
  artist?: { name?: string; artists?: Array<{ artist_mbid: string; name: string; join_phrase?: string }> };
  release_group?: { name?: string; date?: string; type?: string; caa_id?: number; caa_release_mbid?: string };
  tag?: { release_group?: EntityTag[] };
};

export async function fetchReleaseGroupMetadata(mbid: string): Promise<ReleaseGroupMetadata | null> {
  const res = await lbGet<Record<string, ReleaseGroupMetadata>>(
    `${LB_BASE}/metadata/release_group/?release_group_mbids=${encodeURIComponent(mbid)}&inc=artist%20tag%20release`,
    []
  );
  return res?.[mbid] ?? null;
}

/* ───────── Recording ───────── */

export type RecordingMetadata = {
  artist?: { name?: string; artists?: Array<{ artist_mbid: string; name: string; join_phrase?: string }> };
  recording?: { name?: string; length?: number; first_release_date?: string };
  release?: { name?: string; caa_id?: number; caa_release_mbid?: string; mbid?: string; year?: number; release_group_mbid?: string };
  tag?: { recording?: EntityTag[] };
};

export async function fetchRecordingMetadata(mbid: string): Promise<RecordingMetadata | null> {
  const res = await lbGet<Record<string, RecordingMetadata>>(
    `${LB_BASE}/metadata/recording/?recording_mbids=${encodeURIComponent(mbid)}&inc=artist%20tag%20release`,
    []
  );
  return res?.[mbid] ?? null;
}

export type RecordingPopularity = { recording_mbid: string; total_listen_count: number; total_user_count: number };

export async function fetchRecordingPopularity(mbid: string): Promise<RecordingPopularity | null> {
  const res = await fetch(`${LB_BASE}/popularity/recording`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recording_mbids: [mbid] }),
  });
  if (!res.ok) throw new HttpError(res.status, `Popularity ${res.status}`);
  const rows = (await res.json()) as RecordingPopularity[];
  return rows.find((r) => r.recording_mbid === mbid) ?? rows[0] ?? null;
}

/* ───────── Listens built from entity data ───────── */

export type ListenInput = {
  track: string;
  artist: string;
  artists: CreditRef[];
  recording_mbid?: string;
  duration_ms?: number | null;
  release?: string;
  release_mbid?: string;
  release_group_mbid?: string;
  caa_id?: number;
  caa_release_mbid?: string;
};

/** A Listen (ListenCard / player shape) for a MusicBrainz entity. listened_at 0 = not a real listen. */
export function makeListen(p: ListenInput): Listen {
  const artistMbids = p.artists.map((a) => a.artist_mbid);
  return {
    listened_at: 0,
    track_metadata: {
      artist_name: p.artist,
      track_name: p.track,
      release_name: p.release,
      additional_info: {
        recording_mbid: p.recording_mbid || undefined,
        release_mbid: p.release_mbid || undefined,
        release_group_mbid: p.release_group_mbid || undefined,
        duration_ms: p.duration_ms ?? undefined,
        artist_mbids: artistMbids,
      },
      mbid_mapping: {
        recording_mbid: p.recording_mbid ?? "",
        release_mbid: p.release_mbid ?? "",
        release_group_mbid: p.release_group_mbid,
        artist_mbids: artistMbids,
        artists: p.artists.map((a) => ({
          artist_mbid: a.artist_mbid,
          artist_credit_name: a.artist_credit_name,
          join_phrase: a.join_phrase,
        })),
        caa_id: p.caa_id,
        caa_release_mbid: p.caa_release_mbid,
      },
    },
  };
}

/** Listen for a top recording (popularity endpoint row). */
export function popularRecordingToListen(r: PopularRecording): Listen {
  return makeListen({
    track: r.recording_name,
    artist: r.artist_name,
    artists: r.artists ?? [],
    recording_mbid: r.recording_mbid,
    duration_ms: r.length,
    release: r.release_name,
    release_mbid: r.release_mbid,
    caa_id: r.caa_id,
    caa_release_mbid: r.caa_release_mbid,
  });
}

/** Listen for a MusicBrainz recording (lookup or search result). */
export function mbRecordingToListen(
  rec: { id: string; title: string; length?: number | null; "artist-credit"?: Parameters<typeof creditsToRefs>[0] },
  release?: { id: string; title?: string; "release-group"?: { id: string } }
): Listen {
  const refs = creditsToRefs(rec["artist-credit"]);
  return makeListen({
    track: rec.title,
    artist: refs.map((r) => `${r.artist_credit_name}${r.join_phrase}`).join(""),
    artists: refs,
    recording_mbid: rec.id,
    duration_ms: rec.length ?? undefined,
    release: release?.title,
    release_mbid: release?.id,
    release_group_mbid: release?.["release-group"]?.id,
  });
}

export const caaReleaseFront = (releaseMBID?: string | null, size = 250) =>
  releaseMBID ? `${CAA_URL}/release/${releaseMBID}/front-${size}` : undefined;
