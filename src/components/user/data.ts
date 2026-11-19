"use client";

/*
  Shared fetchers and small helpers for the user profile screens (layout + listens page).
  Endpoints that APIService lacks (listens with latest/oldest timestamps, current pin) are read here.
*/

import type APIService from "@/lib/api";
import { getRecordingMBID, getRecordingMSID, getTrackName } from "@/lib/listen";

export type ListensPage = {
  listens: Listen[];
  latestListenTs: number;
  oldestListenTs: number;
};

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const reason = (body as { error?: string }).error;
    throw new Error(reason ?? `ListenBrainz answered ${res.status}.`);
  }
  return (await res.json()) as T;
}

/** One page of a user's listens (newest first), plus the user's latest and oldest listen timestamps. */
export async function fetchListensPage(
  api: APIService,
  userName: string,
  minTs?: number,
  maxTs?: number,
  count = 25
): Promise<ListensPage> {
  const qs = new URLSearchParams({ count: String(count) });
  // The API rejects min_ts and max_ts together, so only one is ever sent.
  if (maxTs) qs.set("max_ts", String(maxTs));
  else if (minTs) qs.set("min_ts", String(minTs));
  const json = await getJSON<{
    payload: { listens: Listen[]; latest_listen_ts?: number; oldest_listen_ts?: number };
  }>(`${api.APIBaseURI}/user/${encodeURIComponent(userName)}/listens?${qs.toString()}`);
  return {
    listens: json.payload.listens ?? [],
    latestListenTs: json.payload.latest_listen_ts ?? 0,
    oldestListenTs: json.payload.oldest_listen_ts ?? 0,
  };
}

/** The user's currently active pin, or null. */
export async function fetchCurrentPin(api: APIService, userName: string): Promise<PinnedRecording | null> {
  const json = await getJSON<{ pinned_recording: PinnedRecording | null }>(
    `${api.APIBaseURI}/${encodeURIComponent(userName)}/pins/current`
  );
  return json.pinned_recording ?? null;
}

/** A pin shaped as a Listen so ListenCard can render and play it. */
export function pinToListen(pin: PinnedRecording): Listen {
  return {
    listened_at: pin.created,
    user_name: pin.user_name ?? null,
    recording_msid: pin.recording_msid ?? null,
    track_metadata: {
      ...pin.track_metadata,
      additional_info: {
        ...(pin.track_metadata?.additional_info ?? {}),
        recording_mbid: pin.recording_mbid ?? undefined,
        recording_msid: pin.recording_msid ?? undefined,
      },
    },
  } as Listen;
}

/** Stable key for a listen row (listened_at plus the recording identity). */
export const listenRowKey = (l: Listen) =>
  `${l.listened_at}-${getRecordingMSID(l) ?? getRecordingMBID(l) ?? getTrackName(l)}`;

/** Similarity is 0..1 from the API; shown as a whole percent. */
export const similarityPercent = (s: number) => `${Math.round(s * 100)}%`;

/** Case-insensitive username comparison (ListenBrainz names are not case-sensitive). */
export const sameUser = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
