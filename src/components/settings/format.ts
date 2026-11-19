/* Small formatters shared by the settings and info pages. */

/** Age in seconds -> "3 h ago". null/undefined means the value has not been produced yet. */
export function fmtAge(seconds?: number | null): string {
  if (seconds == null || Number.isNaN(seconds)) return "Not yet";
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

/** Hides the middle of a token, keeps the first and last four characters. */
export function maskToken(token: string): string {
  const t = token.trim();
  if (t.length <= 8) return "••••••••";
  return `${t.slice(0, 4)}${"•".repeat(12)}${t.slice(-4)}`;
}

/** ListenBrainz writes some timestamps as "2020-04-29 23:40:47" (UTC). */
export function parseLbTimestamp(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}

/** IANA zones the runtime knows about, with UTC always present. */
export function listTimezones(): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [];
  }
  if (!zones.includes("UTC")) zones = ["UTC", ...zones];
  return zones;
}

export function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** Escapes Lucene special characters so free text can be sent to the MusicBrainz search. */
export function escapeLucene(text: string): string {
  return text.replace(/[+\-!(){}[\]^"~*?:\\\/]|&&|\|\|/g, (m) => `\\${m}`);
}

export function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount);
  } catch {
    return `${amount} ${currency.toUpperCase()}`;
  }
}
