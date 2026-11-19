"use client";

import * as React from "react";
import NextLink from "next/link";
import { useLB, errorStatus } from "@/lib/use-lb";
import { requireUser } from "@/lib/auth";
import { useListFeedback } from "@/lib/feedback";
import { Empty, ErrorNote, Link, Panel, SkeletonRows, UserAvatar, UserLink } from "@/components/ui";
import { ListenCard } from "@/components/listen/listen-card";
import { lbGet } from "./lb-fetch";
import { pinnedListen } from "./listen-shapes";

/** Side column of /feed: your current pin, pins from people you follow, and who you follow. */
export function FeedSide({ me }: { me: string }) {
  return (
    <div className="flex flex-col gap-[14px] lg:col-span-2">
      <YourPin me={me} />
      <FollowedPins />
      <WhoYouFollow me={me} />
    </div>
  );
}

function YourPin({ me }: { me: string }) {
  const pin = useLB<PinnedRecording | null>(["feed-pin-current"], async (api, u) => {
    const data = await lbGet<{ pinned_recording: PinnedRecording | null }>(
      api,
      `/${encodeURIComponent(requireUser(u).name)}/pins/current`
    );
    return data.pinned_recording ?? null;
  });
  const listen = pin.data ? pinnedListen(pin.data) : undefined;
  const fb = useListFeedback(listen ? [listen] : undefined);

  return (
    <Panel
      title="Your pin"
      aside={me ? <Link href={`/user/${encodeURIComponent(me)}/taste`} muted>All pins</Link> : null}
    >
      {pin.error && !pin.data ? (
        errorStatus(pin.error) === 404 ? (
          <Empty>No pins for this account.</Empty>
        ) : (
          <ErrorNote error={pin.error} onRetry={() => void pin.mutate()} />
        )
      ) : null}
      {!pin.data && !pin.error && pin.isLoading ? <SkeletonRows rows={1} pitch={64} /> : null}
      {!pin.data && !pin.error && !pin.isLoading ? (
        <Empty>Nothing pinned right now. Pin a track from your listens.</Empty>
      ) : null}
      {pin.data && listen ? (
        <div className="-mx-2">
          <ListenCard listen={listen} feedback={fb.get(listen)} compact meta="" />
          {pin.data.blurb_content ? (
            <p className="px-2 text-[13px] leading-5 text-ink-2">&ldquo;{pin.data.blurb_content}&rdquo;</p>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

function FollowedPins() {
  const pins = useLB<PinnedRecording[]>(["feed-pins-following"], async (api, u) => {
    const data = await lbGet<{ pinned_recordings: PinnedRecording[] }>(
      api,
      `/${encodeURIComponent(requireUser(u).name)}/pins/following?count=5`
    );
    return data.pinned_recordings ?? [];
  });
  const rows = (pins.data ?? []).filter((p) => p.user_name);
  const listens = rows.map(pinnedListen);
  const fb = useListFeedback(listens);

  return (
    <Panel title="Pins from people you follow">
      {pins.error && !pins.data ? <ErrorNote error={pins.error} onRetry={() => void pins.mutate()} /> : null}
      {!pins.data && !pins.error ? <SkeletonRows rows={3} pitch={64} /> : null}
      {pins.data && rows.length === 0 ? <Empty>None of the people you follow has a pin right now.</Empty> : null}
      {rows.length > 0 ? (
        <ul className="-mx-2 flex flex-col">
          {rows.map((p, i) => {
            const l = listens[i];
            return (
              <li key={`${p.user_name}-${p.row_id}`}>
                <ListenCard
                  listen={l}
                  feedback={fb.get(l)}
                  compact
                  meta={<UserLink name={p.user_name as string} />}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </Panel>
  );
}

function WhoYouFollow({ me }: { me: string }) {
  const following = useLB<string[]>(["feed-following"], async (api, u) => {
    const data = await api.getFollowingForUser(requireUser(u).name);
    return data.following ?? [];
  });
  const list = (following.data ?? []).slice(0, 8);

  return (
    <Panel
      title="Who you follow"
      aside={me ? <NextLink href={`/user/${encodeURIComponent(me)}`} className="inline-flex min-h-11 items-center hover:text-white sm:min-h-0">View all</NextLink> : null}
    >
      {following.error && !following.data ? (
        <ErrorNote error={following.error} onRetry={() => void following.mutate()} />
      ) : null}
      {!following.data && !following.error ? <SkeletonRows rows={5} cover={false} pitch={40} /> : null}
      {following.data && list.length === 0 ? <Empty>You are not following anyone yet.</Empty> : null}
      {list.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {list.map((n) => (
            <li key={n} className="flex min-h-10 items-center gap-2 text-[14px]">
              <UserAvatar name={n} size={24} />
              <UserLink name={n} />
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
