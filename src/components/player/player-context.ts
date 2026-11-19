"use client";

import * as React from "react";

/** The playback sources the player can use. */
export type PlayerSource = "youtube" | "internet-archive" | "spotify" | "navidrome" | "none";

export type PlayerState = {
  queue: Listen[];
  /** Index of the current track in `queue`, -1 when nothing is loaded. */
  index: number;
  current?: Listen;
  isPlaying: boolean;
  /** Where the current track is actually playing from. */
  source: PlayerSource;
  progressMs: number;
  durationMs: number;
  volume: number; // 0..100
  /** Readable message when the current track could not be found on any source. */
  error?: string;
};

export type PlayerActions = {
  /** Play one listen now. When `context` is given it becomes the queue (e.g. the list it was clicked in). */
  playListen: (listen: Listen, context?: Listen[]) => void;
  /** Replace the queue and start at `startIndex`. */
  playQueue: (listens: Listen[], startIndex?: number) => void;
  /** Append (or insert right after the current track when `next` is true). */
  addToQueue: (listens: Listen | Listen[], next?: boolean) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (ms: number) => void;
  setVolume: (v: number) => void;
};

export type PlayerContextValue = PlayerState & PlayerActions;

export const PlayerContext = React.createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = React.useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}
