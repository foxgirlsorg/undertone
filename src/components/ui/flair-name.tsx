import * as React from "react";

/*
  A username with its ListenBrainz flair (styles in src/styles/flairs.css, ported from ListenBrainz).
  Some flairs animate each letter, so those get one span per letter, exactly like ListenBrainz's own
  Username component; shake and sliced draw a copy of the name from data-text.
*/

const PER_LETTER = new Set(["flip-3d", "flip-horizontal", "flip-vertical", "lb-colors-sweep", "light-sweep", "wave", "tornado"]);
/** Flairs that only show on hover; `active` shows them all the time (for previews). */
export const HOVER_FLAIRS = new Set(["highlighter", "anaglyph"]);

export function FlairName({
  name,
  flair,
  active = false,
  className,
}: {
  name: string;
  flair?: string | null;
  active?: boolean;
  className?: string;
}) {
  const f = flair || "";
  const classes = ["flair", f, active && HOVER_FLAIRS.has(f) ? "flair-active" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <span className={classes} data-text={name} title={name}>
      {PER_LETTER.has(f)
        ? Array.from(name).map((letter, i) => (
            // Letters repeat, so the index is part of the key.
            <span key={`${letter}${i}`}>{letter}</span>
          ))
        : name}
    </span>
  );
}
