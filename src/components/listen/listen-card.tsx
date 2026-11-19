"use client";

/*
  ListenCard — one row for a track/listen, used on every screen (listens, feed, playlists,
  recommendations, stats top tracks, entity pages).

  <ListenCard listen={l} context={listens} feedback={fb.get(l)} meta="3 min ago" />

  - Click the cover / play button: plays it (queue = `context` when given).
  - Love / hate: submits feedback for the signed-in user (optimistic).
  - The "…" menu: queue, pin, recommend, add to playlist, link to MusicBrainz, delete (own listens), open in MB.
*/

import * as React from "react";
import NextLink from "next/link";
import { Button, Dropdown, Label, toast } from "@heroui/react";
import { Ellipsis, Heart, HeartFill, ThumbsDown, ThumbsDownFill, Play } from "@gravity-ui/icons";
import { useAuth } from "@/lib/auth";
import {
  getArtistCredits,
  getArtistName,
  getCoverArt,
  getRecordingMBID,
  getRecordingMSID,
  getReleaseGroupMBID,
  getReleaseMBID,
  getReleaseName,
  getTrackName,
  getDurationMs,
} from "@/lib/listen";
import { fmtDuration, fmtWhen } from "@/lib/format";
import { CoverArt, cx } from "@/components/ui";
import { usePlayer } from "@/components/player/player-context";
import { ListenModal, type ListenModalKind } from "./listen-modals";
import { MB_URL } from "@/lib/config";

export type ListenCardProps = {
  listen: Listen;
  /** The list this card sits in; becomes the queue when played. */
  context?: Listen[];
  /** Initial love(1)/hate(-1)/none(0) for the signed-in user. */
  feedback?: ListenFeedBack;
  /** Right-hand meta. Defaults to the listened_at time, or the duration when there is no timestamp. */
  meta?: React.ReactNode;
  /** Extra element before the menu (e.g. a listen count, a remove button). */
  aside?: React.ReactNode;
  /** Extra menu items: rendered at the top of the "…" menu. */
  extraActions?: Array<{ id: string; label: string; onAction: () => void; danger?: boolean }>;
  /** Hide the delete action even for own listens (e.g. in playlists). */
  canDelete?: boolean;
  /** Called after a modal action succeeded (e.g. "delete" → remove the row). */
  onDone?: (kind: ListenModalKind) => void;
  /** Rank number shown before the cover (stats lists). */
  rank?: number;
  className?: string;
  compact?: boolean;
};

export function ListenCard({
  listen,
  context,
  feedback,
  meta,
  aside,
  extraActions = [],
  canDelete,
  onDone,
  rank,
  className,
  compact,
}: ListenCardProps) {
  const { api, user } = useAuth();
  const player = usePlayer();
  const [score, setScore] = React.useState<ListenFeedBack>(feedback ?? 0);
  const [modal, setModal] = React.useState<ListenModalKind | null>(null);
  // Re-sync when the list's feedback arrives (derived state, no effect).
  const [seenFeedback, setSeenFeedback] = React.useState(feedback);
  if (seenFeedback !== feedback) {
    setSeenFeedback(feedback);
    setScore(feedback ?? 0);
  }

  const track = getTrackName(listen);
  const artist = getArtistName(listen);
  const credits = getArtistCredits(listen);
  const release = getReleaseName(listen);
  const recMBID = getRecordingMBID(listen);
  const recMSID = getRecordingMSID(listen);
  const rgMBID = getReleaseGroupMBID(listen);
  const relMBID = getReleaseMBID(listen);
  const isCurrent = player.current === listen;
  const isOwn = !!user && (listen as Listen).user_name === user.name;
  const ts = (listen as Listen).listened_at;
  const playingNow = (listen as Listen).playing_now;

  const sendFeedback = async (next: ListenFeedBack) => {
    if (!user) {
      toast("Sign in to love or hate tracks", { variant: "default" });
      return;
    }
    const prev = score;
    const value = score === next ? 0 : next;
    setScore(value);
    try {
      await api.submitFeedback(user.token, value, recMSID, recMBID);
    } catch (e) {
      setScore(prev);
      toast.danger("Couldn't save feedback", { description: (e as Error).message });
    }
  };

  const onMenu = (key: React.Key) => {
    const k = String(key);
    const extra = extraActions.find((a) => a.id === k);
    if (extra) return extra.onAction();
    switch (k) {
      case "play-next":
        player.addToQueue(listen, true);
        toast("Plays next", { description: track });
        return;
      case "queue":
        player.addToQueue(listen);
        toast("Added to queue", { description: track });
        return;
      case "open-mb":
        if (recMBID) window.open(`${MB_URL}/recording/${recMBID}`, "_blank", "noopener");
        return;
      default:
        setModal(k as ListenModalKind);
    }
  };

  const signedIn = !!user;
  const menuItems: Array<{ id: string; label: string; danger?: boolean; show: boolean }> = [
    ...extraActions.map((a) => ({ id: a.id, label: a.label, danger: a.danger, show: true })),
    { id: "play-next", label: "Play next", show: true },
    { id: "queue", label: "Add to queue", show: true },
    { id: "pin", label: "Pin this track", show: signedIn },
    { id: "recommend-followers", label: "Recommend to my followers", show: signedIn },
    { id: "recommend-personal", label: "Personally recommend", show: signedIn },
    { id: "add-to-playlist", label: "Add to playlist", show: signedIn },
    { id: "review", label: "Write a review", show: signedIn && !!(recMBID || rgMBID) },
    { id: "link-mb", label: "Link with MusicBrainz", show: isOwn && !!recMSID && !recMBID },
    { id: "details", label: "Inspect listen", show: true },
    { id: "open-mb", label: "Open in MusicBrainz", show: !!recMBID },
    { id: "delete", label: "Delete listen", danger: true, show: (canDelete ?? isOwn) && !!ts && !playingNow },
  ];

  return (
    <div
      className={cx(
        "group flex items-center gap-3 rounded-[12px] px-2 transition-colors hover:bg-[#161616]",
        compact ? "min-h-[52px] py-1.5" : "min-h-[64px] py-2",
        isCurrent && "bg-[#161616]",
        className
      )}
    >
      {rank != null ? <span className="num w-6 flex-none text-right text-[13px] text-ink-3">{rank}</span> : null}
      <button
        type="button"
        onClick={() => player.playListen(listen, context)}
        aria-label={`Play ${track} by ${artist}`}
        className="relative flex-none rounded"
      >
        <CoverArt src={getCoverArt(listen)} alt={release || track} size={compact ? 40 : 48} />
        <span className="absolute inset-0 flex items-center justify-center rounded bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Play className="size-4" />
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium leading-5">
          {recMBID ? (
            <NextLink href={`/track/${recMBID}`} className="hover:text-data">
              {track}
            </NextLink>
          ) : (
            track
          )}
          {playingNow ? <span className="pill pill-warning ml-2 align-middle">Playing now</span> : null}
        </div>
        <div className="truncate text-[13px] leading-5 text-ink-2">
          {credits.length ? (
            credits.map((c, i) => (
              <React.Fragment key={`${c.artist_mbid}-${i}`}>
                <NextLink href={`/artist/${c.artist_mbid}`} className="hover:text-white">
                  {c.artist_credit_name}
                </NextLink>
                {c.join_phrase}
              </React.Fragment>
            ))
          ) : (
            <span>{artist}</span>
          )}
          {release ? (
            <>
              <span className="text-ink-3"> · </span>
              {rgMBID ? (
                <NextLink href={`/album/${rgMBID}`} className="hover:text-white">
                  {release}
                </NextLink>
              ) : relMBID ? (
                <NextLink href={`/release/${relMBID}`} className="hover:text-white">
                  {release}
                </NextLink>
              ) : (
                <span>{release}</span>
              )}
            </>
          ) : null}
        </div>
      </div>

      {aside}

      <div className="num hidden w-[110px] flex-none text-right text-[12px] text-ink-3 sm:block">
        {meta ?? (playingNow ? "Now" : ts ? fmtWhen(ts) : fmtDuration(getDurationMs(listen)))}
      </div>

      <div className="flex flex-none items-center">
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={score === 1 ? "Remove love" : "Love"}
          aria-pressed={score === 1}
          onPress={() => sendFeedback(1)}
          className={cx(score === 1 ? "text-data" : "text-ink-3 opacity-70 group-hover:opacity-100")}
        >
          {score === 1 ? <HeartFill className="size-4" /> : <Heart className="size-4" />}
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={score === -1 ? "Remove hate" : "Hate"}
          aria-pressed={score === -1}
          onPress={() => sendFeedback(-1)}
          className={cx("hidden sm:inline-flex", score === -1 ? "text-white" : "text-ink-3 opacity-70 group-hover:opacity-100")}
        >
          {score === -1 ? <ThumbsDownFill className="size-4" /> : <ThumbsDown className="size-4" />}
        </Button>
        <Dropdown>
          <Button isIconOnly size="sm" variant="ghost" aria-label={`More actions for ${track}`} className="text-ink-3">
            <Ellipsis className="size-4" />
          </Button>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu onAction={onMenu}>
              {menuItems
                .filter((m) => m.show)
                .map((m) => (
                  <Dropdown.Item key={m.id} id={m.id} textValue={m.label} variant={m.danger ? "danger" : undefined}>
                    <Label>{m.label}</Label>
                  </Dropdown.Item>
                ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>

      <ListenModal
        kind={modal}
        listen={listen}
        onClose={() => setModal(null)}
        onDone={(k) => {
          setModal(null);
          onDone?.(k);
        }}
      />
    </div>
  );
}
