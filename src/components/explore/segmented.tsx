"use client";

import * as React from "react";
import { cx } from "@/components/ui";

export type SegmentOption<T extends string> = { value: T; label: React.ReactNode };

/** Single choice as a row of pills (radio semantics). Same look as the stats range tabs. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: Array<SegmentOption<T>>;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx("-mx-1 flex gap-1 overflow-x-auto px-1", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "h-9 flex-none rounded-full px-3 text-[13px] transition-colors",
              on ? "bg-white font-medium text-black" : "text-[#bbb] hover:bg-[#1c1c1c] hover:text-white"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A toggle chip for multi-select filters (aria-pressed). */
export function ToggleChip({
  pressed,
  onPressedChange,
  children,
}: {
  pressed: boolean;
  onPressedChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onPressedChange}
      className={cx(
        "inline-flex h-8 items-center gap-2 rounded-full px-3 text-[13px] transition-colors",
        pressed ? "bg-white font-medium text-black" : "bg-[#1c1c1c] text-[#bbb] hover:text-white"
      )}
    >
      {children}
    </button>
  );
}
