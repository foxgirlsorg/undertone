"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Empty, ErrorNote, Panel, SkeletonRows } from "@/components/ui";
import { YearReport, YearSwitcher } from "@/components/yim/year-report";
import { useLatestYear } from "@/components/yim/data";

/** Shows the newest Year in Music report the user has (probing 2025 down to 2021). */
export default function YearInMusicIndexPage() {
  const { username: raw } = useParams<{ username: string }>();
  const username = decodeURIComponent(raw);
  const latest = useLatestYear(username);

  if (latest.error) {
    return (
      <div className="flex flex-col gap-[14px]">
        <YearSwitcher username={username} active={null} />
        <ErrorNote error={latest.error} onRetry={() => latest.mutate()} />
      </div>
    );
  }

  if (latest.data === undefined) {
    return (
      <div className="flex flex-col gap-[14px]">
        <YearSwitcher username={username} active={null} />
        <Panel>
          <SkeletonRows rows={4} />
        </Panel>
      </div>
    );
  }

  if (latest.data === null) {
    return (
      <div className="flex flex-col gap-[14px]">
        <YearSwitcher username={username} active={null} />
        <Empty>{username} has no Year in Music report yet.</Empty>
      </div>
    );
  }

  return <YearReport username={username} year={latest.data.year} initial={latest.data.report} />;
}
