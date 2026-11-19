"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useLB } from "@/lib/use-lb";
import { mbQueued } from "@/components/entity/mb";
import { ErrorNote, Loading } from "@/components/ui";

/** A release has no page of its own here: look up its release group and continue on /album/<rg>. */
export default function ReleasePage() {
  const { releaseMBID } = useParams<{ releaseMBID: string }>();
  const mbid = decodeURIComponent(releaseMBID);
  const router = useRouter();
  const lookup = useLB(["release-group-of", mbid], (api) =>
    mbQueued(() => api.lookupMBRelease(mbid, "release-groups")) as Promise<
      MusicBrainzRelease & WithReleaseGroup
    >
  );
  const rgMBID = lookup.data?.["release-group"]?.id;

  React.useEffect(() => {
    if (rgMBID) router.replace(`/album/${rgMBID}`);
  }, [rgMBID, router]);

  if (lookup.error) return <ErrorNote error={lookup.error} onRetry={() => lookup.mutate()} />;
  return <Loading label="Opening album" />;
}
