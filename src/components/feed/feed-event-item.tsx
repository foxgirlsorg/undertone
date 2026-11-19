"use client";

import * as React from "react";
import NextLink from "next/link";
import { Button, Input, Label, TextField, toast } from "@heroui/react";
import { useAuth } from "@/lib/auth";
import { fmtWhen, fmtDateLong } from "@/lib/format";
import { ListenCard } from "@/components/listen/listen-card";
import { UserAvatar, UserLink, cx } from "@/components/ui";
import { NotificationText } from "./notification-text";
import type { FeedEvent } from "./listen-shapes";

const THANKABLE = ["recording_recommendation", "personal_recording_recommendation", "recording_pin"];
const DELETABLE = ["recording_recommendation", "personal_recording_recommendation", "recording_pin"];
const RELATIONSHIP = ["follow", "stop_follow", "block_follow"];

const ORIGINAL_PHRASE: Record<string, string> = {
  recording_recommendation: "recommending a track",
  personal_recording_recommendation: "personally recommending a track",
  recording_pin: "pinning a track",
  critiquebrainz_review: "reviewing",
};

const REVIEW_PHRASE: Record<string, string> = {
  recording: "a track",
  release_group: "an album",
  artist: "an artist",
};

type Props = {
  event: FeedEvent;
  /** The track this event is about (already built with listened_at 0 for non-listens). */
  listen?: Listen;
  feedback?: ListenFeedBack;
  hidden: boolean;
  onHiddenChange: (hidden: boolean) => void;
  onRemoved: () => void;
};

/** One timeline event: who did what, the track, the blurb, and the actions for it. */
export function FeedEventItem({ event, listen, feedback, hidden, onHiddenChange, onRemoved }: Props) {
  const { api, user } = useAuth();
  const me = user?.name ?? "";
  const token = user?.token ?? "";
  const [busy, setBusy] = React.useState(false);
  const [thanking, setThanking] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const type = event.event_type;
  const meta = event.metadata as unknown as Record<string, unknown>;
  const isOwn = event.user_name === me;
  const canHide = !isOwn && event.id != null && !RELATIONSHIP.includes(type);
  const canThank = !isOwn && event.id != null && THANKABLE.includes(type);
  const canDelete = isOwn && event.id != null && DELETABLE.includes(type);
  const blurb = typeof meta.blurb_content === "string" && meta.blurb_content ? meta.blurb_content : null;

  const who = (name: string | null | undefined) =>
    name === me ? <span>You</span> : name ? <UserLink name={name} /> : null;

  // Sentence for the event, in the words of the trade.
  let actorName: string | null | undefined = event.user_name;
  let sentence: React.ReactNode;
  let showAvatar = true;
  switch (type) {
    case "follow":
    case "stop_follow":
    case "block_follow": {
      const verb = type === "follow" ? "started following" : type === "stop_follow" ? "stopped following" : "blocked";
      const target = meta.user_name_1 as string;
      actorName = meta.user_name_0 as string;
      sentence = (
        <>
          {who(actorName)} {verb} {target === me ? "you" : who(target)}
        </>
      );
      break;
    }
    case "notification":
      showAvatar = false;
      actorName = null;
      sentence = <span>ListenBrainz notification</span>;
      break;
    case "thanks": {
      const thanker = meta.thanker_username as string;
      const thankee = meta.thankee_username as string;
      const phrase = ORIGINAL_PHRASE[meta.original_event_type as string] ?? "your activity";
      actorName = thanker;
      sentence =
        thankee === me ? (
          <>
            {who(thanker)} thanked you for {phrase}
          </>
        ) : (
          <>
            {who(thanker)} thanked {who(thankee)} for {phrase}
          </>
        );
      break;
    }
    case "critiquebrainz_review": {
      const kind = REVIEW_PHRASE[meta.entity_type as string] ?? "something";
      sentence = (
        <>
          {who(actorName)} reviewed {kind}
        </>
      );
      break;
    }
    case "personal_recording_recommendation": {
      const toMe = Array.isArray(meta.users) && (meta.users as string[]).includes(me);
      sentence = (
        <>
          {who(actorName)} personally recommended a track{toMe ? " to you" : ""}
        </>
      );
      break;
    }
    case "recording_recommendation":
      sentence = <>{who(actorName)} recommended a track</>;
      break;
    case "recording_pin":
      sentence = <>{who(actorName)} pinned a track</>;
      break;
    case "like":
      sentence = <>{who(actorName)} loved a track</>;
      break;
    case "listen":
      sentence = <>{who(actorName)} listened to a track</>;
      break;
    default:
      sentence = <>{who(actorName)} did something</>;
  }

  const runAction = async (fn: () => Promise<unknown>, okMsg?: string) => {
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      return true;
    } catch (err) {
      toast.danger("Something went wrong", { description: (err as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toggleHidden = async () => {
    if (event.id == null) return;
    const ok = await runAction(() =>
      hidden
        ? api.unhideFeedEvent(type, me, token, event.id as number)
        : api.hideFeedEvent(type, me, token, event.id as number)
    );
    if (ok) onHiddenChange(!hidden);
  };

  const remove = async () => {
    if (event.id == null) return;
    const ok = await runAction(
      () =>
        type === "recording_pin"
          ? api.deletePin(token, event.id as number)
          : api.deleteFeedEvent(type, me, token, event.id as number),
      "Deleted"
    );
    if (ok) onRemoved();
  };

  const sendThanks = async () => {
    if (event.id == null) return;
    const ok = await runAction(
      () => api.thankFeedEvent(event.id, type, token, me, message.trim()),
      "Thanks sent"
    );
    if (ok) {
      setThanking(false);
      setMessage("");
    }
  };

  const time = event.created ? fmtWhen(event.created) : "";

  return (
    <article className="flex gap-3 py-4 first:pt-0" aria-label={`${event.user_name}, ${time}`}>
      {showAvatar && actorName ? (
        <span className="mt-0.5 flex-none">
          <UserAvatar name={actorName} size={32} />
        </span>
      ) : (
        <span className="w-8 flex-none" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className={cx("min-w-0 text-[14px] leading-5", hidden && "text-ink-3")}>{sentence}</p>
          <time
            dateTime={event.created ? new Date(event.created * 1000).toISOString() : undefined}
            title={event.created ? fmtDateLong(event.created) : undefined}
            className="num flex-none whitespace-nowrap text-[12px] text-ink-3"
          >
            {time}
          </time>
        </div>

        {hidden ? (
          <div className="mt-1 flex flex-wrap items-center gap-1 text-[13px] text-ink-3">
            <span>Hidden ·</span>
            <Button size="sm" variant="tertiary" isDisabled={busy} onPress={toggleHidden}>
              Unhide
            </Button>
          </div>
        ) : (
          <>
            {type === "notification" && typeof meta.message === "string" ? (
              <p className="mt-1 text-[14px] leading-5 text-ink-2">
                <NotificationText html={meta.message} />
              </p>
            ) : null}

            {type === "critiquebrainz_review" ? (
              <ReviewBody meta={meta} />
            ) : null}

            {listen ? (
              <div className="-mx-2 mt-1">
                <ListenCard listen={listen} feedback={feedback} compact meta="" />
              </div>
            ) : null}

            {blurb ? <Quote>{blurb}</Quote> : null}

            {canThank || canHide || canDelete ? (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {canThank ? (
                  <Button size="sm" variant="tertiary" isDisabled={busy} onPress={() => setThanking((v) => !v)}>
                    {thanking ? "Cancel thanks" : "Thank"}
                  </Button>
                ) : null}
                {canHide ? (
                  <Button size="sm" variant="tertiary" isDisabled={busy} onPress={toggleHidden}>
                    Hide
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button size="sm" variant="danger-soft" isDisabled={busy} onPress={remove}>
                    Delete
                  </Button>
                ) : null}
              </div>
            ) : null}

            {thanking ? (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <TextField value={message} onChange={setMessage} className="flex min-w-[220px] flex-1 flex-col gap-1">
                  <Label className="sr-only">Message (optional)</Label>
                  <Input placeholder="Add a message (optional)" className="h-9" />
                </TextField>
                <Button size="sm" variant="secondary" isDisabled={busy} onPress={sendThanks}>
                  Send thanks
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

function Quote({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[13px] leading-5 text-ink-2">&ldquo;{children}&rdquo;</p>;
}

function ReviewBody({ meta }: { meta: Record<string, unknown> }) {
  const entityType = meta.entity_type as string;
  const entityId = meta.entity_id as string;
  const entityName = meta.entity_name as string;
  const text = typeof meta.text === "string" ? meta.text : "";
  const href =
    entityType === "release_group" ? `/album/${entityId}` : entityType === "artist" ? `/artist/${entityId}` : null;
  return (
    <div className="mt-1 flex flex-col gap-1">
      {href ? (
        <NextLink href={href} className="w-fit text-[14px] font-medium hover:text-data">
          {entityName}
        </NextLink>
      ) : null}
      {text ? <p className="line-clamp-3 text-[13px] leading-5 text-ink-2">{text}</p> : null}
    </div>
  );
}
