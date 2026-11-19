"use client";

/*
  Side channel for the YouTube video panel. The provider owns the YouTube iframe (so playback
  survives layout changes); the bar only toggles whether the panel is shown.
*/

import * as React from "react";

export type PlayerVideoContextValue = {
  /** Whether the floating YouTube video panel is open. */
  expanded: boolean;
  setExpanded: (v: boolean) => void;
};

export const PlayerVideoContext = React.createContext<PlayerVideoContextValue | null>(null);

export function usePlayerVideo(): PlayerVideoContextValue {
  const ctx = React.useContext(PlayerVideoContext);
  if (!ctx) throw new Error("usePlayerVideo must be used inside <PlayerProvider>");
  return ctx;
}
