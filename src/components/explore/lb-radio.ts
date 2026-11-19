/* LB Radio helpers: enrich the JSPF from the radio with cover art and artist credits. */

export const MB_TRACK_EXTENSION = "https://musicbrainz.org/doc/jspf#track";

export const LB_RADIO_MODES = ["easy", "medium", "hard"] as const;
export type LBRadioMode = (typeof LB_RADIO_MODES)[number];
export const isLBRadioMode = (v: string | null): v is LBRadioMode =>
  LB_RADIO_MODES.includes(v as LBRadioMode);

export type RecordingMetadataMap = Record<
  string,
  {
    recording?: { length?: number };
    release?: { caa_id?: number; caa_release_mbid?: string };
    artist?: { artists?: Array<{ name: string; artist_mbid: string; join_phrase?: string }> };
  }
>;

export function recordingMBIDFromTrack(track: JSPFTrack): string | undefined {
  return track.identifier?.[0]?.split("/").pop();
}

/** Adds cover art, duration and artist credits to each track (mutates, as the reference does). */
export function enrichTracks(tracks: JSPFTrack[], meta: RecordingMetadataMap | null): JSPFTrack[] {
  if (!meta) return tracks;
  for (const track of tracks) {
    const mbid = recordingMBIDFromTrack(track);
    const m = mbid ? meta[mbid] : undefined;
    if (!m) continue;
    if (m.recording?.length != null) track.duration = m.recording.length;
    const ext = (track.extension ?? {}) as Record<string, unknown>;
    ext[MB_TRACK_EXTENSION] = {
      additional_metadata: {
        caa_id: m.release?.caa_id,
        caa_release_mbid: m.release?.caa_release_mbid,
        artists: m.artist?.artists?.map((a) => ({
          artist_credit_name: a.name,
          artist_mbid: a.artist_mbid,
          join_phrase: a.join_phrase ?? "",
        })),
      },
    };
    track.extension = ext as JSPFTrack["extension"];
  }
  return tracks;
}
