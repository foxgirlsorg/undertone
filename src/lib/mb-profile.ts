"use client";

/*
  The public MusicBrainz editor profile of a ListenBrainz user, read through our own route
  /api/mb-profile/[username] (the server fetches and caches it; the browser keeps it in memory only,
  via SWR, never in localStorage).
*/

import useSWR from "swr";

export type MBLanguage = { name: string; level: string };

export type MBProfile = {
  name: string;
  /** Gravatar or MetaBrainz avatar. Absent when the editor has none. */
  avatarUrl?: string;
  /** http(s) URL of the homepage. */
  homepage?: string;
  /** musicbrainz.org hides this editor's homepage from anonymous visitors (new editors, against spam). */
  homepageHidden?: boolean;
  /** Plain text, e.g. "Barcelona, Catalunya, Spain". */
  location?: string;
  /** Raw text from MusicBrainz, e.g. "The dawn of the project" or a date. */
  memberSince?: string;
  userType?: string[];
  languages?: MBLanguage[];
  /** Sanitise before rendering: the client uses DOMPurify. */
  bioHtml?: string;
  subscribers?: number;
};

/** Resolves to null when MusicBrainz has no such editor. Throws on any other failure. */
export async function fetchMBProfile(name: string): Promise<MBProfile | null> {
  const res = await fetch(`/api/mb-profile/${encodeURIComponent(name)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Profile request failed (${res.status})`);
  return (await res.json()) as MBProfile;
}

export function useMBProfile(name: string | undefined) {
  return useSWR<MBProfile | null>(name ? `mb-profile:${name}` : null, () => fetchMBProfile(name as string), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    dedupingInterval: 60_000,
  });
}
