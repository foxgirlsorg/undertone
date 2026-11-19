/* Helpers for the Fresh releases screen and the index thumbnail (no React here). */

export type FreshSort = "release_date" | "artist_credit_name" | "release_name" | "confidence";

export const FRESH_DAY_OPTIONS = [7, 14, 30, 90] as const;
export type FreshDays = (typeof FRESH_DAY_OPTIONS)[number];

export const RELEASE_CATEGORIES = ["Album", "Single", "EP", "Other"] as const;
export type ReleaseCategory = (typeof RELEASE_CATEGORIES)[number];

export function releaseCategory(r: FreshReleaseItem): ReleaseCategory {
  const p = r.release_group_primary_type;
  if (p === "Album" || p === "Single" || p === "EP") return p;
  return "Other";
}

/** Same release name + artist (case-insensitive) is the same release, as on the reference site. */
export function dedupeReleases(list: FreshReleaseItem[]): FreshReleaseItem[] {
  const seen = new Set<string>();
  const out: FreshReleaseItem[] = [];
  for (const r of list) {
    const key = `${r.release_name.toLowerCase()}|${r.artist_credit_name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function localISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Key used to cut the grid into sections for the chosen sort. */
export function groupKey(sort: FreshSort, r: FreshReleaseItem): string {
  switch (sort) {
    case "release_date":
      return r.release_date || "-";
    case "artist_credit_name":
      return (r.artist_credit_name || "").charAt(0).toUpperCase() || "#";
    case "release_name":
      return (r.release_name || "").charAt(0).toUpperCase() || "#";
    case "confidence":
      return String(Math.round((r.confidence ?? 0) * 10) / 10);
  }
}

/** "Today", "Yesterday", "Friday 14 Nov" (year added when it is not this year), or the sort's own label. */
export function groupLabel(sort: FreshSort, key: string): string {
  if (sort === "release_date") {
    if (key === "-") return "No date";
    const d = new Date(`${key}T00:00:00`);
    if (Number.isNaN(d.getTime())) return key;
    const today = localISODate(new Date());
    if (key === today) return "Today";
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (key === localISODate(yesterday)) return "Yesterday";
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "short",
      ...(sameYear ? {} : { year: "numeric" }),
    }).format(d);
  }
  if (sort === "confidence") return `Confidence ${key}`;
  return key;
}

/** Keeps the server order but cuts it into labelled sections. */
export function groupReleases(
  sort: FreshSort,
  list: FreshReleaseItem[]
): Array<{ key: string; label: string; items: FreshReleaseItem[] }> {
  const groups: Array<{ key: string; label: string; items: FreshReleaseItem[] }> = [];
  const index = new Map<string, number>();
  for (const r of list) {
    const key = groupKey(sort, r);
    let i = index.get(key);
    if (i === undefined) {
      i = groups.length;
      index.set(key, i);
      groups.push({ key, label: groupLabel(sort, key), items: [] });
    }
    groups[i].items.push(r);
  }
  return groups;
}

export const SORT_LABELS: Record<FreshSort, string> = {
  release_date: "Release date",
  artist_credit_name: "Artist",
  release_name: "Title",
  confidence: "Confidence",
};

/** Pulls the release list out of the (untyped) fresh releases response. */
export function releasesFromResponse(res: unknown): FreshReleaseItem[] {
  const r = res as { payload?: { releases?: FreshReleaseItem[] } } | null;
  return r?.payload?.releases ?? [];
}
