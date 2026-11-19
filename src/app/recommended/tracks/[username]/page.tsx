"use client";

import { useParams } from "next/navigation";
import { RawRecommendedTracks } from "@/components/playlists/recommended-tracks";

export default function RecommendedTracksPage() {
  const { username } = useParams<{ username: string }>();
  return <RawRecommendedTracks username={decodeURIComponent(username)} />;
}
