/* Stats art: options and URL builders for the /1/art endpoints (see art_api.py). */

export const ART_RANGES = [
  { value: "this_week", label: "This week" },
  { value: "week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "month", label: "Last month" },
  { value: "quarter", label: "Last quarter" },
  { value: "half_yearly", label: "Last 6 months" },
  { value: "this_year", label: "This year" },
  { value: "year", label: "Last year" },
  { value: "all_time", label: "All time" },
] as const;
export type ArtRange = (typeof ART_RANGES)[number]["value"];
export const DEFAULT_ART_RANGE: ArtRange = "this_month";

/** Named designs served by /1/art/{custom_name}/{user}/{range}/{size}. */
export const ART_DESIGNS = [
  { value: "designer-top-5", label: "Designer top 5" },
  { value: "designer-top-10", label: "Designer top 10" },
  { value: "designer-top-10-alt", label: "Designer top 10 (alt)" },
  { value: "lps-on-the-floor", label: "LPs on the floor" },
] as const;
export type ArtDesign = (typeof ART_DESIGNS)[number]["value"];

/** Grid tile designs per dimension, mirroring GRID_TILE_DESIGNS in cover_art_generator.py. */
export const ART_GRID_LAYOUTS: Record<number, number[]> = {
  1: [0],
  2: [0],
  3: [0, 1, 2],
  4: [0, 1, 2, 3],
  5: [0, 1],
};

export const ART_SIZES = [500, 750, 1000] as const;
export type ArtSize = (typeof ART_SIZES)[number];

export type ArtGridOptions = {
  caption: boolean;
  skipMissing: boolean;
  showRank: boolean;
  showArtist: boolean;
  showRelease: boolean;
  showListenCount: boolean;
};

export const DEFAULT_GRID_OPTIONS: ArtGridOptions = {
  caption: true,
  skipMissing: true,
  showRank: false,
  showArtist: true,
  showRelease: true,
  showListenCount: false,
};

/** Builds the SVG URL for the chosen style. Only sends query flags that differ from the server defaults. */
export function artUrl(opts: {
  apiBase: string;
  user: string;
  range: ArtRange;
  size: ArtSize;
  design: "grid" | ArtDesign;
  dimension: number;
  layout: number;
  grid: ArtGridOptions;
}): string {
  const user = encodeURIComponent(opts.user);
  if (opts.design !== "grid") {
    return `${opts.apiBase}/1/art/${opts.design}/${user}/${opts.range}/${opts.size}`;
  }
  const q = new URLSearchParams();
  if (!opts.grid.caption) q.set("caption", "false");
  if (!opts.grid.skipMissing) q.set("skip-missing", "false");
  if (opts.grid.showRank) q.set("show-rank", "true");
  if (opts.grid.showListenCount) q.set("show-listen-count", "true");
  if (!opts.grid.showRelease) q.set("show-release", "false");
  if (!opts.grid.showArtist) q.set("show-artist", "false");
  const qs = q.toString();
  return `${opts.apiBase}/1/art/grid-stats/${user}/${opts.range}/${opts.dimension}/${opts.layout}/${opts.size}${
    qs ? `?${qs}` : ""
  }`;
}

export const isArtRange = (v: string | null): v is ArtRange => ART_RANGES.some((r) => r.value === v);
export const isArtDesign = (v: string | null): v is ArtDesign => ART_DESIGNS.some((d) => d.value === v);
