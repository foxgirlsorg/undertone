"use client";

import { useParams } from "next/navigation";
import { PlaylistsView } from "@/components/playlists/playlist-list";

export default function UserCollaborationsPage() {
  const { username } = useParams<{ username: string }>();
  return <PlaylistsView username={decodeURIComponent(username)} mode="collaborations" />;
}
