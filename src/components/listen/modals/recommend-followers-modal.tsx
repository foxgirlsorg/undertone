"use client";

import * as React from "react";
import { Button, Modal, toast } from "@heroui/react";
import { useAuth } from "@/lib/auth";
import { getRecordingMBID, getRecordingMSID } from "@/lib/listen";
import { ModalShell, TrackRow, errorText, trackLabel, type ListenModalProps } from "./shared";

export function RecommendFollowersModal({ open, listen, onClose, onDone }: ListenModalProps) {
  return (
    <ModalShell open={open} onClose={onClose} title="Recommend to your followers">
      <RecommendFollowersForm listen={listen} onClose={onClose} onDone={onDone} />
    </ModalShell>
  );
}

function RecommendFollowersForm({ listen, onClose, onDone }: Omit<ListenModalProps, "open">) {
  const { api, user } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const mbid = getRecordingMBID(listen);
  const msid = getRecordingMSID(listen);
  const hasId = !!(mbid || msid);
  const canSend = !!user && hasId && !busy;

  const send = async () => {
    if (!user || !hasId) return;
    setBusy(true);
    try {
      await api.recommendTrackToFollowers(user.name, user.token, {
        recording_mbid: mbid,
        recording_msid: msid,
      });
      toast.success("Recommended to your followers", { description: trackLabel(listen) });
      onDone();
    } catch (err) {
      toast.danger("Couldn't recommend this track", { description: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal.Body className="flex flex-col gap-4">
        <TrackRow listen={listen} />
        <p className="text-[14px] text-ink-2">
          This goes into every follower’s feed as a recommendation. It has no note attached; use “Personally recommend”
          to add one.
        </p>
        {hasId ? null : (
          <p className="text-[14px] text-negative">This listen has no recording id, so it can’t be recommended.</p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="tertiary" onPress={onClose}>
          Cancel
        </Button>
        <Button onPress={send} isDisabled={!canSend}>
          {busy ? "Sending…" : "Recommend"}
        </Button>
      </Modal.Footer>
    </>
  );
}
