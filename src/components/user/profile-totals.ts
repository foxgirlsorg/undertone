"use client";

/*
  All-time totals for the profile header strip. Each value is its own SWR request, so a slow or
  failed one shows "—" without holding up the others.
*/

import { useLB } from "@/lib/use-lb";

export function useProfileTotals(name: string) {
  const listens = useLB(["listen-count", name], (api) => api.getUserListenCount(name));

  const artists = useLB(["profile-total", "artist", name], async (api) => {
    const d = (await api.getUserEntity(name, "artist", "all_time", 0, 1)) as UserArtistsResponse;
    return d.payload.total_artist_count;
  });

  // Albums: release groups first; if they are not calculated, fall back to releases.
  const releaseGroups = useLB(["profile-total", "release-group", name], async (api) => {
    const d = (await api.getUserEntity(name, "release-group", "all_time", 0, 1)) as UserReleaseGroupsResponse;
    return d.payload.total_release_group_count;
  });
  const releases = useLB(
    releaseGroups.error ? ["profile-total", "release", name] : null,
    async (api) => {
      const d = (await api.getUserEntity(name, "release", "all_time", 0, 1)) as UserReleasesResponse;
      return d.payload.total_release_count;
    }
  );
  const albums = releaseGroups.data ?? releases.data;

  const tracks = useLB(["profile-total", "recording", name], async (api) => {
    const d = (await api.getUserEntity(name, "recording", "all_time", 0, 1)) as UserRecordingsResponse;
    return d.payload.total_recording_count;
  });

  const loved = useLB(["profile-total", "loved", name], async (api) => {
    const d = (await api.getFeedbackForUser(name, 0, 1, 1)) as { total_count?: number };
    return d.total_count;
  });

  return {
    listens: listens.data,
    artists: artists.data,
    albums,
    tracks: tracks.data,
    loved: loved.data,
  };
}
