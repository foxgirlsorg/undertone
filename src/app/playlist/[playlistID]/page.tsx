"use client";

import { useParams } from "next/navigation";
import { PlaylistDetail } from "@/components/playlists/playlist-detail";

export default function PlaylistPage() {
  const { playlistID } = useParams<{ playlistID: string }>();
  return <PlaylistDetail playlistMBID={decodeURIComponent(playlistID)} />;
}
