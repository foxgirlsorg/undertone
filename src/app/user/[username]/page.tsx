"use client";

import * as React from "react";
import { RangeTabs } from "@/components/ui";
import { ListeningActivityPanel } from "@/components/stats/blocks";
import { useStatsRange } from "@/components/stats/use-stats";
import { AboutPanel } from "@/components/user/about-panel";
import { PinnedPanel } from "@/components/user/pinned-panel";
import { FollowingFollowersPanel, SimilarUsersPanel } from "@/components/user/social-panels";
import {
  OVERVIEW_RANGES,
  RecentListensPreview,
  TopAlbumsBlock,
  TopArtistsBlock,
  TopTracksBlock,
} from "@/components/user/overview-blocks";
import { useUserName } from "@/components/user/use-user-name";

export default function UserOverviewPage() {
  return (
    <React.Suspense fallback={null}>
      <OverviewView />
    </React.Suspense>
  );
}

/** One period control for the whole page, kept in ?range=. Recent listens and pinned/social do not depend on it. */
function OverviewView() {
  const name = useUserName();
  const [raw, setRange] = useStatsRange("week");
  const range: UserStatsAPIRange = OVERVIEW_RANGES.some((r) => r.key === raw) ? raw : "week";

  return (
    <div className="flex flex-col gap-[14px] pb-6">
      <RangeTabs value={range} onChange={setRange} ranges={OVERVIEW_RANGES} />

      <div className="grid gap-[14px] lg:grid-cols-6">
        <div className="min-w-0 lg:col-span-4">
          <RecentListensPreview name={name} />
        </div>
        <div className="flex min-w-0 flex-col gap-[14px] max-lg:order-last lg:col-span-2">
          <AboutPanel name={name} />
          <PinnedPanel name={name} />
          <FollowingFollowersPanel name={name} />
          <SimilarUsersPanel name={name} />
        </div>

        <TopArtistsBlock name={name} range={range} className="min-w-0 lg:col-span-6" />
        <TopAlbumsBlock name={name} range={range} className="min-w-0 lg:col-span-6" />
        <TopTracksBlock name={name} range={range} className="min-w-0 lg:col-span-6" />
        <ListeningActivityPanel user={name} range={range} className="min-w-0 lg:col-span-6" />
      </div>
    </div>
  );
}
