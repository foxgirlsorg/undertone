"use client";

/*
  Shared helpers for playlists and recommendations: JSPF accessors (same rules as the official
  frontend's playlists/utils.tsx), a JSPF-track → Listen adapter for ListenCard, the playlist
  description renderer, and download/fetch helpers.
*/

import * as React from "react";
import DOMPurify from "dompurify";
import type APIService from "@/lib/api";
import { LB_WEB_URL } from "@/lib/config";

export const PLAYLIST_EXT = "https://musicbrainz.org/doc/jspf#playlist";
export const TRACK_EXT = "https://musicbrainz.org/doc/jspf#track";
export const PLAYLIST_URI_PREFIX = "https://listenbrainz.org/playlist/";
export const RECORDING_URI_PREFIX = "https://musicbrainz.org/recording/";
export const ARTIST_URI_PREFIX = "https://musicbrainz.org/artist/";
export const RELEASE_URI_PREFIX = "https://musicbrainz.org/release/";

export const getPlaylistExt = (pl?: JSPFPlaylist | null): JSPFPlaylistExtension | undefined =>
  (pl?.extension?.[PLAYLIST_EXT] as JSPFPlaylistExtension | undefined) ?? undefined;

export const getTrackExt = (t?: JSPFTrack | null): JSPFTrackExtension | undefined =>
  (t?.extension?.[TRACK_EXT] as JSPFTrackExtension | undefined) ?? undefined;

export const playlistId = (pl?: { identifier?: string } | null) =>
  pl?.identifier?.replace(PLAYLIST_URI_PREFIX, "") ?? "";

export const isPlaylistPublic = (pl?: JSPFPlaylist | null) => getPlaylistExt(pl)?.public ?? false;

export const collaboratorsOf = (pl?: JSPFPlaylist | null): string[] => getPlaylistExt(pl)?.collaborators ?? [];

export const isOwner = (pl: JSPFPlaylist | null | undefined, name?: string | null) =>
  !!name && pl?.creator === name;

export const isCollaborator = (pl: JSPFPlaylist | null | undefined, name?: string | null) =>
  !!name && collaboratorsOf(pl).includes(name);

/** Owners and collaborators can change the track list. */
export const canEditTracks = (pl: JSPFPlaylist | null | undefined, name?: string | null) =>
  isOwner(pl, name) || isCollaborator(pl, name);

const toIdentifiers = (identifier: string | string[] | undefined): string[] =>
  identifier == null ? [] : Array.isArray(identifier) ? identifier : [identifier];

/** The recording MBID of a JSPF track (its identifier is a string or an array of URIs). */
export function trackRecordingMBID(t: JSPFTrack): string {
  const ids = toIdentifiers(t.identifier);
  const uri = ids.find((i) => i.startsWith(RECORDING_URI_PREFIX)) ?? ids[0] ?? "";
  return uri.split("/").pop() ?? "";
}

const uriToMBID = (uri: string) => uri.split("/").pop() ?? "";

/**
 * JSPF track → Listen for ListenCard. Unlike the shared jspfTrackToListen this accepts a string
 * identifier, and it does not set user_name (so ListenCard never offers to delete a listen here).
 */
export function trackToListen(t: JSPFTrack): Listen {
  const recordingMBID = trackRecordingMBID(t);
  const ext = getTrackExt(t);
  const add = (ext?.additional_metadata ?? {}) as Record<string, unknown>;
  const artistMBIDs = (ext?.artist_identifiers ?? []).map(uriToMBID);
  const releaseMBID = ext?.release_identifier ? uriToMBID(ext.release_identifier) : undefined;
  const artists = (add.artists as MBIDMappingArtist[] | undefined) ?? [];
  const caaId = add.caa_id as number | undefined;
  const caaReleaseMBID = add.caa_release_mbid as string | undefined;
  return {
    listened_at: 0,
    track_metadata: {
      track_name: t.title,
      artist_name: t.creator,
      release_name: t.album,
      additional_info: {
        recording_mbid: recordingMBID,
        duration_ms: t.duration,
        release_mbid: releaseMBID,
        artist_mbids: artistMBIDs,
      },
      mbid_mapping: {
        recording_mbid: recordingMBID,
        release_mbid: releaseMBID ?? "",
        artist_mbids: artistMBIDs,
        artists,
        caa_id: caaId,
        caa_release_mbid: caaReleaseMBID,
      },
    },
  };
}

/** Who added a track and when, from the track extension. */
export function trackAddedBy(t: JSPFTrack): { by?: string; at?: string } {
  const ext = getTrackExt(t);
  return { by: ext?.added_by, at: ext?.added_at };
}

/** Build a JSPF track from a MusicBrainz recording (the minimum the server needs to add it). */
export function recordingToJSPFTrack(rec: {
  id: string;
  title: string;
  length?: number;
  artistName: string;
  releaseTitle?: string;
}): JSPFTrack {
  return {
    identifier: [`${RECORDING_URI_PREFIX}${rec.id}`],
    title: rec.title,
    creator: rec.artistName,
    album: rec.releaseTitle,
    duration: rec.length,
  };
}

export const totalDurationMs = (tracks: JSPFTrack[]) =>
  tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0);

/** Source patch → a human label for the generated playlists (weekly jams, top discoveries, …). */
export type RecommendationKind = { key: string; label: string; order: number };

export function recommendationKind(pl: JSPFPlaylist): RecommendationKind {
  const patch = getPlaylistExt(pl)?.additional_metadata?.algorithm_metadata?.source_patch ?? "";
  if (patch === "weekly-jams") return { key: "weekly-jams", label: "Weekly Jams", order: 0 };
  if (patch === "weekly-exploration") return { key: "weekly-exploration", label: "Weekly Exploration", order: 1 };
  if (patch === "daily-jams") return { key: "daily-jams", label: "Daily Jams", order: 2 };
  if (patch.startsWith("top-discoveries-of-")) return { key: "top-discoveries", label: "Top Discoveries", order: 3 };
  if (patch.startsWith("top-missed-recordings-of-")) return { key: "top-missed", label: "Top Missed Tracks", order: 4 };
  return { key: `other-${pl.identifier}`, label: pl.title, order: 5 };
}

/** The year in a top-discoveries / top-missed source patch, when there is one. */
export function recommendationYear(pl: JSPFPlaylist): string | undefined {
  const patch = getPlaylistExt(pl)?.additional_metadata?.algorithm_metadata?.source_patch ?? "";
  return patch.match(/\d{4}/)?.[0];
}

export const createdTime = (pl: JSPFPlaylist) => Date.parse(pl.date) || 0;

export const modifiedTime = (pl: JSPFPlaylist) =>
  Date.parse(getPlaylistExt(pl)?.last_modified_at ?? pl.date) || 0;

export const lbPlaylistUrl = (id: string) => `${LB_WEB_URL}/playlist/${id}/`;

/** Save a Blob as a file. Used for XSPF / JSPF exports the user asked for. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]+/g, " ").trim() || "playlist";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Fetch every page of a user's playlists (created, collaborations or recommendations). */
export async function fetchAllUserPlaylists(
  api: APIService,
  username: string,
  token: string | undefined,
  opts: { createdFor?: boolean; collaborator?: boolean } = {}
): Promise<JSPFObject[]> {
  const out: JSPFObject[] = [];
  let total = Infinity;
  while (out.length < total) {
    const res = await api.getUserPlaylists(username, token, out.length, 100, !!opts.createdFor, !!opts.collaborator);
    total = res.playlist_count;
    if (!res.playlists?.length) break;
    out.push(...res.playlists);
  }
  return out;
}

/** Fetch every page of the server's search results for a user's playlists. */
export async function searchAllUserPlaylists(api: APIService, username: string, query: string): Promise<JSPFObject[]> {
  const out: JSPFObject[] = [];
  let total = Infinity;
  while (out.length < total) {
    const res = await api.searchPlaylistsForUser(query, username, 100, out.length);
    total = res.playlist_count ?? res.count ?? 0;
    const page = (res.playlists ?? []).map((p) => ({ playlist: { ...p.playlist, track: [] } }) as unknown as JSPFObject);
    if (!page.length) break;
    out.push(...page);
  }
  return out;
}

export async function getPlaylistJSON(api: APIService, id: string, token?: string): Promise<JSPFObject> {
  const res = await api.getPlaylist(id, token);
  return (await res.json()) as JSPFObject;
}

/* ---------- Description: server HTML, sanitized with DOMPurify ---------- */

let descriptionHooked = false;

/** Keeps a, b, i, strong, em and br; links are http(s) only and open in a new tab. */
function sanitizeDescription(html: string): string {
  if (!descriptionHooked) {
    descriptionHooked = true;
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer nofollow");
      }
    });
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["a", "b", "i", "strong", "em", "br"],
    ALLOWED_ATTR: ["href"],
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  });
}

/**
 * Renders a playlist description. The server sends HTML; it is sanitized before it is injected.
 * Without a DOM (server render) only the text is shown, as React text, never raw HTML.
 */
export function renderDescription(html: string): React.ReactNode[] {
  if (typeof window === "undefined") return [plainDescription(html)];
  return [
    <span
      key="description"
      className="[&_a]:text-data [&_a]:underline-offset-2 [&_a:hover]:underline"
      dangerouslySetInnerHTML={{ __html: sanitizeDescription(html) }}
    />,
  ];
}

/** Playlist description for display, or null when empty. */
export function plainDescription(html?: string | null): string {
  return (html ?? "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}
