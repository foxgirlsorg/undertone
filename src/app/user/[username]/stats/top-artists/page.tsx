"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { TopEntityPage } from "@/components/stats/top-entity-page";

export default function UserTopArtistsPage() {
  return (
    <React.Suspense fallback={null}>
      <UserTop />
    </React.Suspense>
  );
}

function UserTop() {
  const { username } = useParams<{ username: string }>();
  return <TopEntityPage user={username} entity="artist" />;
}
