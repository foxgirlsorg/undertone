"use client";

import * as React from "react";
import { UserLink, Empty, ErrorNote, Panel, SkeletonRows, Link } from "@/components/ui";
import { Button } from "@heroui/react";
import { fmtWhen } from "@/lib/format";
import { useListFeedback } from "@/lib/feedback";
import { ListenCard } from "@/components/listen/listen-card";
import { usePagedTimeline, type PagedTimelineOptions } from "./use-paged-timeline";

type ListenEvent = TimelineEvent<Listen>;

const listenKey = (e: ListenEvent) =>
  `${e.user_name}-${e.metadata.listened_at}-${e.metadata.recording_msid ?? e.metadata.track_metadata?.track_name ?? ""}`;

const FOLLOWING: PagedTimelineOptions<ListenEvent> = {
  cacheKey: "feed-following-listens",
  fetchHead: (api, user) => api.getListensFromFollowedUsers(user.name, user.token),
  fetchOlder: (api, user, beforeTs) => api.getListensFromFollowedUsers(user.name, user.token, undefined, beforeTs),
  keyOf: listenKey,
  cursorOf: (e) => e.metadata.listened_at,
};

const SIMILAR: PagedTimelineOptions<ListenEvent> = {
  cacheKey: "feed-similar-listens",
  fetchHead: (api, user) => api.getListensFromSimilarUsers(user.name, user.token),
  fetchOlder: (api, user, beforeTs) => api.getListensFromSimilarUsers(user.name, user.token, undefined, beforeTs),
  keyOf: listenKey,
  cursorOf: (e) => e.metadata.listened_at,
};

/** Listens from people you follow, or from users with a similar taste. Newest first, paged older. */
export function ListenFeed({ mode }: { mode: "following" | "similar" }) {
  const tl = usePagedTimeline(mode === "following" ? FOLLOWING : SIMILAR);
  const listens = tl.items.map((e) => e.metadata);
  const fb = useListFeedback(listens);
  const title = mode === "following" ? "Listens from people you follow" : "Listens from similar listeners";
  const empty = mode === "following" ? "No listens from people you follow yet." : "No listens from similar listeners yet.";

  return (
    <Panel
      as="section"
      title={title}
      aside={
        <Button size="sm" variant="secondary" isDisabled={tl.isLoading} onPress={() => void tl.refresh()}>
          Newer
        </Button>
      }
    >
      {tl.error && tl.items.length === 0 ? <ErrorNote error={tl.error} onRetry={tl.retry} /> : null}
      {tl.isLoading ? <SkeletonRows rows={6} /> : null}
      {!tl.isLoading && !tl.error && tl.items.length === 0 ? <Empty>{empty}</Empty> : null}

      {tl.items.length > 0 ? (
        <ul className="flex flex-col">
          {tl.items.map((e) => (
            <li key={listenKey(e)}>
              <ListenCard
                listen={e.metadata}
                feedback={fb.get(e.metadata)}
                aside={
                  <span className="num hidden w-[72px] flex-none text-right text-[12px] text-ink-3 md:block">
                    {fmtWhen(e.metadata.listened_at)}
                  </span>
                }
                meta={
                  <span className="block truncate">
                    {e.user_name ? <UserLink name={e.user_name} /> : null}
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      ) : null}

      {tl.olderError ? (
        <div className="mt-3">
          <ErrorNote error={tl.olderError} onRetry={() => void tl.loadOlder()} />
        </div>
      ) : null}
      {tl.items.length > 0 && tl.canLoadOlder ? (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" isDisabled={tl.loadingOlder} onPress={() => void tl.loadOlder()}>
            {tl.loadingOlder ? "Loading…" : "Older listens"}
          </Button>
        </div>
      ) : null}
      {tl.items.length > 0 && !tl.canLoadOlder ? (
        <p className="mt-4 text-center text-[13px] text-ink-3">
          Nothing older. <Link href="/feed" muted>Back to your feed</Link>
        </p>
      ) : null}
    </Panel>
  );
}
