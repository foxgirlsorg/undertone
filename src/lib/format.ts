import { formatDistanceToNowStrict, format } from "date-fns";

const nf = new Intl.NumberFormat("en-US");

/** 12,345 */
export const fmtInt = (n?: number | null) => (n == null ? "—" : nf.format(Math.round(n)));

/** 1.2k / 3.4M — only for capacity lines and dense labels. */
export const fmtCompact = (n?: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** "3 min ago", "Yesterday", or a date for anything older than a week. Accepts unix seconds, ms, ISO or Date. */
export function fmtWhen(input?: number | string | Date | null): string {
  if (input == null || input === 0) return "—";
  const d = toDate(input);
  const diff = Date.now() - d.getTime();
  if (diff < 45_000) return "Just now";
  if (diff < 7 * 86_400_000) return `${formatDistanceToNowStrict(d)} ago`;
  return format(d, d.getFullYear() === new Date().getFullYear() ? "d MMM, HH:mm" : "d MMM yyyy");
}

/** 2024-02-15 */
export const fmtDate = (input?: number | string | Date | null) =>
  input == null ? "—" : format(toDate(input), "yyyy-MM-dd");

/** 15 Feb 2024 */
export const fmtDateLong = (input?: number | string | Date | null) =>
  input == null ? "—" : format(toDate(input), "d MMM yyyy");

/** 3:07 / 1:02:44 from milliseconds. */
export function fmtDuration(ms?: number | null): string {
  if (!ms && ms !== 0) return "—";
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** 41 h 12 m from milliseconds (listening time). */
export function fmtHours(ms?: number | null): string {
  if (ms == null) return "—";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${nf.format(h)} h ${m} m` : `${m} m`;
}

export function toDate(input: number | string | Date): Date {
  if (input instanceof Date) return input;
  if (typeof input === "number") return new Date(input < 1e12 ? input * 1000 : input);
  return new Date(input);
}

export const plural = (n: number, one: string, many = `${one}s`) => `${fmtInt(n)} ${n === 1 ? one : many}`;

/** Stats API ranges, with the words used on screen. */
export const STATS_RANGES: Array<{ key: UserStatsAPIRange; label: string }> = [
  { key: "this_week", label: "This week" },
  { key: "this_month", label: "This month" },
  { key: "this_year", label: "This year" },
  { key: "week", label: "Last week" },
  { key: "month", label: "Last month" },
  { key: "quarter", label: "Last quarter" },
  { key: "half_yearly", label: "Last half year" },
  { key: "year", label: "Last year" },
  { key: "all_time", label: "All time" },
];
