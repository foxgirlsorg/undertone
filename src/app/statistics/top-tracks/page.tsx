"use client";

import * as React from "react";
import { TopEntityPage } from "@/components/stats/top-entity-page";

export default function SiteTopTracksPage() {
  return (
    <React.Suspense fallback={null}>
      <TopEntityPage entity="recording" />
    </React.Suspense>
  );
}
