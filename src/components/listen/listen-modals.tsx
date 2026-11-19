"use client";

/*
  ListenModal — the modal for one listen action. ListenCard holds `kind` (null = closed) and
  calls onClose when the dialog closes; onDone(kind) after a successful action.
  Each action lives in ./modals/ and mounts its dialog content only while open.
*/

import { PinModal } from "./modals/pin-modal";
import { RecommendFollowersModal } from "./modals/recommend-followers-modal";
import { RecommendPersonalModal } from "./modals/recommend-personal-modal";
import { AddToPlaylistModal } from "./modals/add-to-playlist-modal";
import { LinkMBModal } from "./modals/link-mb-modal";
import { DeleteListenModal } from "./modals/delete-modal";
import { DetailsModal } from "./modals/details-modal";
import { ReviewModal } from "./modals/review-modal";

export type ListenModalKind =
  | "pin"
  | "recommend-followers"
  | "recommend-personal"
  | "add-to-playlist"
  | "link-mb"
  | "delete"
  | "details"
  | "review";

export function ListenModal({
  kind,
  listen,
  onClose,
  onDone,
}: {
  kind: ListenModalKind | null;
  listen: Listen;
  onClose: () => void;
  onDone?: (kind: ListenModalKind) => void;
}) {
  if (!kind) return null;

  const common = { listen, onClose };
  const done = (k: ListenModalKind) => () => onDone?.(k);

  return (
    <>
      <PinModal {...common} open={kind === "pin"} onDone={done("pin")} />
      <RecommendFollowersModal {...common} open={kind === "recommend-followers"} onDone={done("recommend-followers")} />
      <RecommendPersonalModal {...common} open={kind === "recommend-personal"} onDone={done("recommend-personal")} />
      <AddToPlaylistModal {...common} open={kind === "add-to-playlist"} onDone={done("add-to-playlist")} />
      <LinkMBModal {...common} open={kind === "link-mb"} onDone={done("link-mb")} />
      <DeleteListenModal {...common} open={kind === "delete"} onDone={done("delete")} />
      <DetailsModal {...common} open={kind === "details"} onDone={done("details")} />
      <ReviewModal {...common} open={kind === "review"} onDone={done("review")} />
    </>
  );
}
