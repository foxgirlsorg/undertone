"use client";

import { useLB } from "./use-lb";
import { getRecordingMBID, getRecordingMSID } from "./listen";

/**
 * Loads the signed-in user's love/hate feedback for every listen in a list, in one request.
 *   const fb = useListFeedback(listens);
 *   <ListenCard listen={l} feedback={fb.get(l)} />
 */
export function useListFeedback(listens: Listen[] | undefined) {
  const mbids = Array.from(new Set((listens ?? []).map(getRecordingMBID).filter(Boolean))) as string[];
  const msids = Array.from(new Set((listens ?? []).map(getRecordingMSID).filter(Boolean))) as string[];
  const { data } = useLB(
    mbids.length || msids.length ? ["feedback-for", mbids.join(","), msids.join(",")] : null,
    async (api, user) => {
      if (!user) return [] as FeedbackResponse[];
      const res = await api.getFeedbackForUserForRecordings(user.name, mbids, msids);
      return (res?.feedback ?? []) as FeedbackResponse[];
    }
  );
  const byMbid = new Map<string, ListenFeedBack>();
  const byMsid = new Map<string, ListenFeedBack>();
  (data ?? []).forEach((f) => {
    if (f.recording_mbid) byMbid.set(f.recording_mbid, f.score);
    if (f.recording_msid) byMsid.set(f.recording_msid, f.score);
  });
  return {
    get(l: Listen): ListenFeedBack | undefined {
      const mbid = getRecordingMBID(l);
      const msid = getRecordingMSID(l);
      return (mbid ? byMbid.get(mbid) : undefined) ?? (msid ? byMsid.get(msid) : undefined);
    },
  };
}
