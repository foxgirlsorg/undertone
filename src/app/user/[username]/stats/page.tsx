"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { StatsView } from "@/components/stats/stats-view";

export default function UserStatsPage() {
  return (
    <React.Suspense fallback={null}>
      <UserStats />
    </React.Suspense>
  );
}

function UserStats() {
  const { username } = useParams<{ username: string }>();
  return <StatsView user={username} />;
}
