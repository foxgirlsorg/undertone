"use client";

import { useParams } from "next/navigation";
import { RecommendedPlaylists } from "@/components/playlists/recommended-playlists";

export default function UserRecommendationsPage() {
  const { username } = useParams<{ username: string }>();
  return <RecommendedPlaylists username={decodeURIComponent(username)} />;
}
