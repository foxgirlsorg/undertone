"use client";

/*
  Shapes: turn feed events, pins and feedback rows into the Listen shape ListenCard expects.
  listened_at 0 means "not a listen": ListenCard then hides the delete-listen action.
*/

export type FeedEvent = TimelineEvent<EventMetadata>;

export function feedEventKey(e: FeedEvent): string {
  return `${e.event_type}-${e.id ?? "x"}-${e.user_name}-${e.created}`;
}

/** The track a feed event is about, or undefined for events without a recording. */
export function trackListenFromEvent(event: FeedEvent): Listen | undefined {
  const m = event.metadata as unknown;
  switch (event.event_type) {
    case "listen":
    case "like": {
      const l = m as Listen;
      return l?.track_metadata ? l : undefined;
    }
    case "recording_recommendation":
    case "recording_pin": {
      const l = m as Listen;
      return l?.track_metadata ? { ...l, listened_at: 0 } : undefined;
    }
    case "personal_recording_recommendation": {
      const p = m as UserTrackPersonalRecommendationMetadata;
      const mbid = p.recording_mbid ?? p.track_metadata?.additional_info?.recording_mbid ?? undefined;
      const msid = p.recording_msid ?? p.track_metadata?.additional_info?.recording_msid ?? undefined;
      if (!p.track_metadata && !mbid && !msid) return undefined;
      return {
        listened_at: 0,
        recording_msid: msid ?? null,
        track_metadata: {
          ...p.track_metadata,
          artist_name: p.track_metadata?.artist_name ?? "",
          track_name: p.track_metadata?.track_name ?? "",
          additional_info: { ...p.track_metadata?.additional_info, recording_mbid: mbid, recording_msid: msid },
        },
      };
    }
    case "critiquebrainz_review": {
      const r = m as CritiqueBrainzReview;
      if (r.entity_type !== "recording") return undefined;
      return {
        listened_at: 0,
        track_metadata: {
          artist_name: "",
          track_name: r.entity_name,
          additional_info: { recording_mbid: r.entity_id },
        },
      };
    }
    default:
      return undefined;
  }
}

/** A pinned recording as a non-listen Listen (for ListenCard). */
export function pinnedListen(pin: PinnedRecording): Listen {
  const mbid = pin.recording_mbid ?? pin.track_metadata?.additional_info?.recording_mbid ?? undefined;
  const msid = pin.recording_msid ?? pin.track_metadata?.additional_info?.recording_msid ?? undefined;
  return {
    listened_at: 0,
    user_name: pin.user_name ?? null,
    recording_msid: msid ?? null,
    track_metadata: {
      ...pin.track_metadata,
      artist_name: pin.track_metadata?.artist_name ?? "",
      track_name: pin.track_metadata?.track_name ?? "",
      additional_info: { ...pin.track_metadata?.additional_info, recording_mbid: mbid, recording_msid: msid },
    },
  };
}

/** A loved/hated row from the feedback API as a non-listen Listen. */
export function feedbackListen(item: FeedbackResponseWithTrackMetadata): Listen {
  const mbid = item.recording_mbid ?? item.track_metadata?.additional_info?.recording_mbid ?? undefined;
  return {
    listened_at: 0,
    recording_msid: item.recording_msid,
    track_metadata: {
      ...item.track_metadata,
      additional_info: { ...item.track_metadata?.additional_info, recording_mbid: mbid, recording_msid: item.recording_msid },
    },
  };
}
