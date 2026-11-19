"use client";

import * as React from "react";
import { Page } from "@/components/ui";
import { StatsView } from "@/components/stats/stats-view";

export default function SiteStatisticsPage() {
  return (
    <Page title="Site statistics" subtitle="Listening across everyone on ListenBrainz">
      <React.Suspense fallback={null}>
        <StatsView />
      </React.Suspense>
    </Page>
  );
}
