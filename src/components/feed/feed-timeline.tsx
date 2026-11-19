"use client";

import * as React from "react";
import { Button } from "@heroui/react";
import { useAuth } from "@/lib/auth";
import { useListFeedback } from "@/lib/feedback";
import { Empty, ErrorNote, Panel, SkeletonRows } from "@/components/ui";
import { FeedEventItem } from "./feed-event-item";
import { FeedSide } from "./feed-side";
import { feedEventKey, trackListenFromEvent, type FeedEvent } from "./listen-shapes";
import { usePagedTimeline, type PagedTimelineOptions } from "./use-paged-timeline";

const FEED: PagedTimelineOptions<FeedEvent> = {
  cacheKey: "feed",
  fetchHead: (api, user) => api.getFeedForUser(user.name, user.token),
  fetchOlder: (api, user, beforeTs) => api.getFeedForUser(user.name, user.token, undefined, beforeTs),
  keyOf: feedEventKey,
  cursorOf: (e) => e.created,
};

type Patch = { hidden?: boolean; removed?: boolean };

/** The signed-in user's timeline (main column) and side column. */
export function FeedTimeline() {
  const { user } = useAuth();
  const tl = usePagedTimeline(FEED);
  const [patches, setPatches] = React.useState<Record<string, Patch>>({});

  const visible = tl.items.filter((e) => !patches[feedEventKey(e)]?.removed);
  const listens = visible.map((e) => trackListenFromEvent(e)).filter((l): l is Listen => !!l);
  const fb = useListFeedback(listens);

  const patch = (e: FeedEvent, p: Patch) =>
    setPatches((prev) => ({ ...prev, [feedEventKey(e)]: { ...prev[feedEventKey(e)], ...p } }));

  return (
    <div className="grid items-start gap-[14px] lg:grid-cols-6">
      <Panel as="section" className="lg:col-span-4" title="Latest activity" aside={
        <Button size="sm" variant="secondary" isDisabled={tl.isLoading} onPress={() => void tl.refresh()}>
          Newer
        </Button>
      }>
        {tl.error ? <ErrorNote error={tl.error} onRetry={tl.retry} /> : null}
        {tl.isLoading ? <SkeletonRows rows={5} cover={false} pitch={96} /> : null}
        {!tl.isLoading && !tl.error && visible.length === 0 ? (
          <Empty>Nothing in your feed yet. Follow someone or recommend a track to start it.</Empty>
        ) : null}

        {visible.length > 0 ? (
          <ol className="flex flex-col divide-y divide-[#1f1f1f]">
            {visible.map((event) => {
              const key = feedEventKey(event);
              const listen = trackListenFromEvent(event);
              return (
                <li key={key}>
                  <FeedEventItem
                    event={event}
                    listen={listen}
                    feedback={listen ? fb.get(listen) : undefined}
                    hidden={!!(patches[key]?.hidden ?? event.hidden)}
                    onHiddenChange={(hidden) => patch(event, { hidden })}
                    onRemoved={() => patch(event, { removed: true })}
                  />
                </li>
              );
            })}
          </ol>
        ) : null}

        {tl.olderError ? <div className="mt-3"><ErrorNote error={tl.olderError} onRetry={() => void tl.loadOlder()} /></div> : null}
        {visible.length > 0 && tl.canLoadOlder ? (
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" isDisabled={tl.loadingOlder} onPress={() => void tl.loadOlder()}>
              {tl.loadingOlder ? "Loading…" : "Older events"}
            </Button>
          </div>
        ) : null}
        {visible.length > 0 && !tl.canLoadOlder ? (
          <p className="mt-4 text-center text-[13px] text-ink-3">You have reached the start of your feed.</p>
        ) : null}
      </Panel>

      <FeedSide me={user?.name ?? ""} />
    </div>
  );
}
