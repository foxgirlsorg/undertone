"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Loading } from "@/components/ui";

/** A release group has its page at /album/<mbid>; this route only forwards old links. */
export default function ReleaseGroupRedirect() {
  const { mbid } = useParams<{ mbid: string }>();
  const router = useRouter();
  React.useEffect(() => {
    router.replace(`/album/${encodeURIComponent(decodeURIComponent(mbid))}`);
  }, [mbid, router]);
  return <Loading label="Opening album" />;
}
