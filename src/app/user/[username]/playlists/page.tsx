"use client";

import { useParams } from "next/navigation";
import { PlaylistsView } from "@/components/playlists/playlist-list";

export default function UserPlaylistsPage() {
  const { username } = useParams<{ username: string }>();
  return <PlaylistsView username={decodeURIComponent(username)} mode="created" />;
}
