"use client";

/*
  StatsView — the statistics screen for one user (`user` given) or for everyone (sitewide).
  Range comes from `?range=` (default "week", like the reference). Sitewide has no daily activity
  or genre activity, so those two blocks are only rendered for a user.
*/

import * as React from "react";
import { Button } from "@heroui/react";
import { Empty, RangeTabs, Panel } from "@/components/ui";
import { useLB } from "@/lib/use-lb";
import { STATS_RANGES } from "@/lib/format";
import {
  ArtistActivityPanel,
  ArtistMapPanel,
  DailyActivityPanel,
  EraPanel,
  EvolutionPanel,
  GenreActivityPanel,
  ListeningActivityPanel,
  TopAlbumsPanel,
  TopArtistsPanel,
  TopTracksPanel,
} from "./blocks";
import { isNotCalculated, useStatsRange } from "./use-stats";

export function StatsView({ user }: { user?: string }) {
  const [range, setRange] = useStatsRange("week");
  const scope = { user, range };
  // Same SWR key as the Listening activity block, so this costs no extra request. When the period
  // has no stats at all, show one message instead of eleven identical empty panels.
  const probe = useLB(["stats-listening", user ?? "sitewide", range], (api) => api.getUserListeningActivity(user, range));
  const nothing = !!probe.error && isNotCalculated(probe.error);
  const label = STATS_RANGES.find((r) => r.key === range)?.label.toLowerCase() ?? "this period";

  return (
    <div className="flex flex-col gap-[14px]">
      <RangeTabs value={range} onChange={setRange} />

      {nothing ? (
        <Panel>
          <Empty
            action={
              range !== "all_time" ? (
                <Button size="sm" variant="secondary" onPress={() => setRange("all_time")}>
                  Show all time
                </Button>
              ) : null
            }
          >
            {range === "all_time"
              ? "Statistics haven't been calculated yet. ListenBrainz updates them daily."
              : `No statistics for ${label}${user ? ` — ${user} may not have listened then` : ""}.`}
          </Empty>
        </Panel>
      ) : (
      <div className="grid gap-[14px] lg:grid-cols-6">
        <ListeningActivityPanel {...scope} className="lg:col-span-4" />
        <TopArtistsPanel {...scope} className="lg:col-span-2" />

        <TopAlbumsPanel {...scope} className="lg:col-span-3" />
        <TopTracksPanel {...scope} className="lg:col-span-3" />

        {user ? (
          <>
            <DailyActivityPanel user={user} range={range} className="lg:col-span-6" />
            <GenreActivityPanel user={user} range={range} className="lg:col-span-6" />
          </>
        ) : null}

        <EraPanel {...scope} className="lg:col-span-6" />
        <ArtistActivityPanel {...scope} className="lg:col-span-6" />

        <EvolutionPanel {...scope} className="lg:col-span-6" />
        <ArtistMapPanel {...scope} className="lg:col-span-6" />
      </div>
      )}
    </div>
  );
}
