"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Panel, SkeletonRows } from "@/components/ui";
import { RecentListensPanel } from "@/components/user/recent-listens-panel";
import { useUserName } from "@/components/user/use-user-name";

export default function UserListensPage() {
  return (
    <React.Suspense
      fallback={
        <Panel>
          <SkeletonRows rows={6} />
        </Panel>
      }
    >
      <ListensView />
    </React.Suspense>
  );
}

function ListensView() {
  const name = useUserName();
  const params = useSearchParams();
  const minTs = toTs(params.get("min_ts"));
  const maxTs = toTs(params.get("max_ts"));

  return (
    <div className="min-w-0 pb-6">
      <RecentListensPanel key={name} name={name} minTs={minTs} maxTs={maxTs} />
    </div>
  );
}

/** Unix seconds from a query value; anything that is not a positive integer is ignored. */
function toTs(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
