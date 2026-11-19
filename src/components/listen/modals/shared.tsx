"use client";

import * as React from "react";
import { Modal } from "@heroui/react";
import { CoverArt } from "@/components/ui";
import { getArtistName, getCoverArt, getTrackName } from "@/lib/listen";

/** Props every listen modal receives from ListenModal. */
export type ListenModalProps = {
  open: boolean;
  listen: Listen;
  onClose: () => void;
  /** The action succeeded. The parent closes the modal and updates its list. */
  onDone: () => void;
};

/** Controlled dialog shell. Its children only mount while the dialog is open, so form state resets on each open. */
export function ModalShell({
  open,
  onClose,
  title,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Modal.Backdrop isOpen={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Container>
        <Modal.Dialog className={wide ? "sm:max-w-[560px]" : "sm:max-w-[440px]"}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>
          {children}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** The track being acted on: cover, title, artist. */
export function TrackRow({ listen }: { listen: Listen }) {
  const track = getTrackName(listen) || "Unknown track";
  const artist = getArtistName(listen) || "Unknown artist";
  return (
    <div className="flex items-center gap-3 rounded-[12px] bg-raised p-2">
      <CoverArt src={getCoverArt(listen)} alt={track} size={48} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium">{track}</div>
        <div className="truncate text-[13px] text-ink-2">{artist}</div>
      </div>
    </div>
  );
}

export function trackLabel(listen: Listen): string {
  return `${getTrackName(listen) || "Unknown track"} by ${getArtistName(listen) || "unknown artist"}`;
}

export function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err ?? "Something went wrong.");
}
