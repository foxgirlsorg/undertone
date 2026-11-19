/* Helpers for reading the ListenBrainz `Listen` shape (see lb-types.d.ts). */
import { CAA_URL } from "./config";

type AnyListen = Listen | BaseListenFormat;

export const getTrackName = (l?: AnyListen) =>
  l?.track_metadata?.track_name ?? "";

export const getArtistName = (l?: AnyListen) =>
  l?.track_metadata?.mbid_mapping?.artists
    ?.map((a) => `${a.artist_credit_name}${a.join_phrase ?? ""}`)
    .join("") ||
  l?.track_metadata?.artist_name ||
  "";

export const getReleaseName = (l?: AnyListen) =>
  l?.track_metadata?.release_name ?? "";

export const getRecordingMBID = (l?: AnyListen) =>
  l?.track_metadata?.additional_info?.recording_mbid ??
  l?.track_metadata?.mbid_mapping?.recording_mbid ??
  undefined;

export const getRecordingMSID = (l?: AnyListen) =>
  (l as Listen | undefined)?.recording_msid ??
  l?.track_metadata?.additional_info?.recording_msid ??
  undefined;

export const getReleaseMBID = (l?: AnyListen) =>
  l?.track_metadata?.additional_info?.release_mbid ??
  l?.track_metadata?.mbid_mapping?.release_mbid ??
  undefined;

export const getReleaseGroupMBID = (l?: AnyListen) =>
  l?.track_metadata?.additional_info?.release_group_mbid ??
  l?.track_metadata?.mbid_mapping?.release_group_mbid ??
  undefined;

export const getArtistMBIDs = (l?: AnyListen): string[] =>
  l?.track_metadata?.additional_info?.artist_mbids ??
  l?.track_metadata?.mbid_mapping?.artist_mbids ??
  l?.track_metadata?.mbid_mapping?.artists?.map((a) => a.artist_mbid) ??
  [];

/** Artist credits with their MBIDs, for linking each artist separately. */
export const getArtistCredits = (l?: AnyListen) =>
  l?.track_metadata?.mbid_mapping?.artists ?? [];

export const getDurationMs = (l?: AnyListen): number | undefined => {
  const info = l?.track_metadata?.additional_info;
  if (info?.duration_ms) return info.duration_ms;
  if (info?.duration) return info.duration * 1000;
  return undefined;
};

/** Cover art URL for a listen, from CAA ids in mbid_mapping or the release MBID. */
export function getCoverArt(l?: AnyListen, size: 250 | 500 | 1200 = 250): string | undefined {
  const m = l?.track_metadata?.mbid_mapping;
  if (m?.caa_id && m?.caa_release_mbid) {
    return `${CAA_URL}/release/${m.caa_release_mbid}/${m.caa_id}-${size}.jpg`;
  }
  const rel = getReleaseMBID(l);
  if (rel) return `${CAA_URL}/release/${rel}/front-${size}`;
  return undefined;
}

export const releaseCover = (releaseMBID?: string | null, size: 250 | 500 | 1200 = 250) =>
  releaseMBID ? `${CAA_URL}/release/${releaseMBID}/front-${size}` : undefined;

export const releaseGroupCover = (rgMBID?: string | null, size: 250 | 500 | 1200 = 250) =>
  rgMBID ? `${CAA_URL}/release-group/${rgMBID}/front-${size}` : undefined;

export const caaCover = (caaReleaseMBID?: string | null, caaId?: number | string | null, size: 250 | 500 | 1200 = 250) =>
  caaReleaseMBID && caaId ? `${CAA_URL}/release/${caaReleaseMBID}/${caaId}-${size}.jpg` : undefined;

/** A stable key for a listen in a list. */
export const listenKey = (l: AnyListen, i = 0) =>
  `${(l as Listen).listened_at ?? 0}-${getRecordingMSID(l) ?? getRecordingMBID(l) ?? getTrackName(l)}-${i}`;

type JSPFTrackExt = {
  added_by?: string;
  added_at?: string;
  artist_identifiers?: string[];
  release_identifier?: string;
  additional_metadata?: {
    artists?: Array<{ artist_credit_name: string; artist_mbid: string; join_phrase: string }>;
    caa_id?: number;
    caa_release_mbid?: string;
  };
};

const lastSegment = (u?: string) => u?.replace(/\/+$/, "").split("/").pop();

/** Build a minimal Listen from a JSPF track (playlists → player / ListenCard). */
export function jspfTrackToListen(track: JSPFTrack): Listen {
  const ids = track.identifier as unknown as string | string[] | undefined;
  const recording_mbid = lastSegment(Array.isArray(ids) ? ids[0] : ids);
  const ext = (track.extension?.["https://musicbrainz.org/doc/jspf#track"] ?? {}) as JSPFTrackExt;
  const meta = ext.additional_metadata ?? {};
  return {
    listened_at: 0,
    user_name: ext.added_by,
    track_metadata: {
      track_name: track.title,
      artist_name: track.creator,
      release_name: track.album,
      additional_info: {
        recording_mbid,
        duration_ms: track.duration,
        artist_mbids: ext.artist_identifiers?.map((u) => lastSegment(u) ?? ""),
        release_mbid: lastSegment(ext.release_identifier),
      },
      mbid_mapping: {
        recording_mbid: recording_mbid ?? "",
        artists: meta.artists ?? [],
        caa_id: meta.caa_id,
        caa_release_mbid: meta.caa_release_mbid,
      } as MBIDMapping,
    },
  };
}
