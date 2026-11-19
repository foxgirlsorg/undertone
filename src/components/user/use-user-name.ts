"use client";

import { useParams } from "next/navigation";

/** The profile's username from the [username] route segment, decoded. */
export function useUserName(): string {
  const params = useParams<{ username: string }>();
  const raw = String(params.username ?? "");
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
