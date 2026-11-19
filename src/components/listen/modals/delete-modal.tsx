"use client";

import * as React from "react";
import { Button, Modal, toast } from "@heroui/react";
import { useAuth } from "@/lib/auth";
import { getRecordingMSID } from "@/lib/listen";
import { fmtWhen } from "@/lib/format";
import { ModalShell, TrackRow, errorText, trackLabel, type ListenModalProps } from "./shared";

export function DeleteListenModal({ open, listen, onClose, onDone }: ListenModalProps) {
  return (
    <ModalShell open={open} onClose={onClose} title="Delete this listen?">
      <DeleteForm listen={listen} onClose={onClose} onDone={onDone} />
    </ModalShell>
  );
}

function DeleteForm({ listen, onClose, onDone }: Omit<ListenModalProps, "open">) {
  const { api, user } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const msid = getRecordingMSID(listen);
  const listenedAt = listen.listened_at;
  const canDelete = !!user && !!msid && !!listenedAt && !busy;

  const remove = async () => {
    if (!user || !msid || !listenedAt) return;
    setBusy(true);
    try {
      await api.deleteListen(user.token, msid, listenedAt);
      toast.success("Listen deleted", { description: trackLabel(listen) });
      onDone();
    } catch (err) {
      toast.danger("Couldn't delete this listen", { description: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal.Body className="flex flex-col gap-4">
        <TrackRow listen={listen} />
        <p className="text-[14px] text-ink-2">
          Listened {fmtWhen(listenedAt)}. This removes the listen from your history and can’t be undone.
        </p>
        <p className="text-[14px] text-ink-3">Deleted listens can take up to an hour to disappear from your stats.</p>
        {msid && listenedAt ? null : (
          <p className="text-[14px] text-negative">This listen is missing its id or timestamp, so it can’t be deleted.</p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="tertiary" onPress={onClose}>
          Cancel
        </Button>
        <Button variant="danger-soft" onPress={remove} isDisabled={!canDelete}>
          {busy ? "Deleting…" : "Delete listen"}
        </Button>
      </Modal.Footer>
    </>
  );
}
