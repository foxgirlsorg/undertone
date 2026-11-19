"use client";

import * as React from "react";
import { TopEntityPage } from "@/components/stats/top-entity-page";

export default function SiteTopArtistsPage() {
  return (
    <React.Suspense fallback={null}>
      <TopEntityPage entity="artist" />
    </React.Suspense>
  );
}
