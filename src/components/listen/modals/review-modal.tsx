"use client";

import * as React from "react";
import { Button, Modal } from "@heroui/react";
import { getRecordingMBID, getReleaseGroupMBID, getReleaseName, getTrackName } from "@/lib/listen";
import { Empty } from "@/components/ui";
import { ModalShell, TrackRow, type ListenModalProps } from "./shared";

const CRITIQUEBRAINZ_URL = "https://critiquebrainz.org";

export function ReviewModal({ open, listen, onClose }: ListenModalProps) {
  return (
    <ModalShell open={open} onClose={onClose} title="Write a review">
      <ReviewBody listen={listen} onClose={onClose} />
    </ModalShell>
  );
}

function ReviewBody({ listen, onClose }: Pick<ListenModalProps, "listen" | "onClose">) {
  const recMBID = getRecordingMBID(listen);
  const rgMBID = getReleaseGroupMBID(listen);

  // Reviews are written per recording when we know it, otherwise per album (release group).
  const entity = recMBID
    ? { kind: "recording" as const, mbid: recMBID, name: getTrackName(listen), noun: "recording" }
    : rgMBID
      ? { kind: "release_group" as const, mbid: rgMBID, name: getReleaseName(listen), noun: "album" }
      : null;

  const open = () => {
    if (!entity) return;
    window.open(`${CRITIQUEBRAINZ_URL}/review/write/${entity.kind}/${entity.mbid}`, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <Modal.Body className="flex flex-col gap-4">
        {entity ? (
          <>
            <TrackRow listen={listen} />
            <p className="text-[14px] text-ink-2">
              Reviews are written on CritiqueBrainz for the {entity.noun}
              {entity.name ? ` “${entity.name}”` : ""}. CritiqueBrainz needs its own sign-in, so the review form opens
              in a new tab there.
            </p>
          </>
        ) : (
          <Empty>This listen isn’t linked to MusicBrainz yet. Link it first to review the track or album.</Empty>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="tertiary" onPress={onClose}>
          Cancel
        </Button>
        <Button onPress={open} isDisabled={!entity}>
          Open CritiqueBrainz
        </Button>
      </Modal.Footer>
    </>
  );
}
