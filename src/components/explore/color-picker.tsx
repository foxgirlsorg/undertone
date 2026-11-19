"use client";

import * as React from "react";
import { ColorArea, ColorSlider } from "@heroui/react";
import { parseColor, type Color } from "react-aria-components";

const DEFAULT_HEX = "eb743b";

/** Hex without the leading # (what the API takes), lower case. */
export const toHex = (c: Color) => c.toString("hex").slice(1).toLowerCase();

export const isHex6 = (v: string | undefined): v is string => !!v && /^[0-9a-f]{6}$/i.test(v);

/**
 * Saturation/brightness area plus a hue slider. The colour is only reported when the drag ends,
 * so a drag does not fire a request per pixel.
 */
export function HuePicker({
  hex,
  onCommit,
}: {
  hex: string | undefined;
  onCommit: (hex: string) => void;
}) {
  const [color, setColor] = React.useState<Color>(() => parseColor(`#${isHex6(hex) ? hex : DEFAULT_HEX}`));

  // Follow the URL when it changes from outside (back button, a shared link). Adjusting state while
  // rendering keeps this to one pass instead of an effect that re-renders after paint.
  const [seenHex, setSeenHex] = React.useState(hex);
  if (hex !== seenHex) {
    setSeenHex(hex);
    if (isHex6(hex) && hex.toLowerCase() !== toHex(color)) {
      setColor(parseColor(`#${hex}`));
    }
  }

  const commit = (next: Color) => {
    setColor(next);
    onCommit(toHex(next));
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <ColorArea
        aria-label="Saturation and brightness"
        colorSpace="hsb"
        xChannel="saturation"
        yChannel="brightness"
        value={color}
        onChange={setColor}
        onChangeEnd={commit}
        className="h-56 w-full"
      >
        <ColorArea.Thumb />
      </ColorArea>
      <ColorSlider
        aria-label="Hue"
        channel="hue"
        colorSpace="hsb"
        value={color}
        onChange={setColor}
        onChangeEnd={commit}
      >
        <ColorSlider.Track className="h-4 w-full rounded-full">
          <ColorSlider.Thumb />
        </ColorSlider.Track>
      </ColorSlider>
      <div className="flex items-center gap-3 text-[13px] text-ink-2">
        <span aria-hidden className="size-6 rounded-full" style={{ background: color.toString("css") }} />
        <span className="num">#{toHex(color)}</span>
      </div>
    </div>
  );
}
