"use client";

import * as React from "react";
import { TopEntityPage } from "@/components/stats/top-entity-page";

export default function SiteTopAlbumsPage() {
  return (
    <React.Suspense fallback={null}>
      <TopEntityPage entity="release-group" />
    </React.Suspense>
  );
}
