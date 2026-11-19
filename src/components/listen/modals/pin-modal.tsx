"use client";

import * as React from "react";
import { Button, Description, Label, Modal, TextArea, TextField, toast } from "@heroui/react";
import { useAuth } from "@/lib/auth";
import { getRecordingMBID, getRecordingMSID } from "@/lib/listen";
import { ModalShell, TrackRow, errorText, trackLabel, type ListenModalProps } from "./shared";

const MAX_BLURB = 280;

export function PinModal({ open, listen, onClose, onDone }: ListenModalProps) {
  return (
    <ModalShell open={open} onClose={onClose} title="Pin this track">
      <PinForm listen={listen} onClose={onClose} onDone={onDone} />
    </ModalShell>
  );
}

function PinForm({ listen, onClose, onDone }: Omit<ListenModalProps, "open">) {
  const { api, user } = useAuth();
  const [blurb, setBlurb] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const msid = getRecordingMSID(listen);
  const mbid = getRecordingMBID(listen);
  const canPin = !!user && !!msid && !busy;

  const pin = async () => {
    if (!user || !msid) return;
    setBusy(true);
    try {
      await api.submitPinRecording(user.token, msid, mbid, blurb.trim() || undefined);
      toast.success("Track pinned", { description: trackLabel(listen) });
      onDone();
    } catch (err) {
      toast.danger("Couldn't pin this track", { description: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal.Body className="flex flex-col gap-4">
        <TrackRow listen={listen} />
        <p className="text-[14px] text-ink-2">
          Pinning replaces the track you have pinned now. Your pinned track also expires after one week.
        </p>
        {msid ? null : (
          <p className="text-[14px] text-negative">This listen has no recording id, so it can&apos;t be pinned.</p>
        )}
        <TextField value={blurb} onChange={setBlurb} className="flex flex-col gap-2">
          <Label>Why this track?</Label>
          <TextArea
            rows={4}
            maxLength={MAX_BLURB}
            placeholder="Optional. Your followers see this next to the pin."
            className="w-full"
          />
          <Description>Shown to your followers on your profile.</Description>
        </TextField>
        <p className="num text-right text-[12px] text-ink-3">
          {blurb.length} / {MAX_BLURB}
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="tertiary" onPress={onClose}>
          Cancel
        </Button>
        <Button onPress={pin} isDisabled={!canPin}>
          {busy ? "Pinning…" : "Pin track"}
        </Button>
      </Modal.Footer>
    </>
  );
}
