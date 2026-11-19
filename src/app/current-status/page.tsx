"use client";

import { Empty, ErrorNote, KpiStrip, Kpi, Loading, Page, Panel, SkeletonRows } from "@/components/ui";
import { apiGet } from "@/components/settings/api-fetch";
import { fmtAge } from "@/components/settings/format";
import { fmtInt, fmtWhen, STATS_RANGES } from "@/lib/format";
import { useLB } from "@/lib/use-lb";

type ServiceStatus = {
  time: number;
  dump_age: number | null;
  stats_age: number | null;
  sitewide_stats_age: number | null;
  incoming_listen_count: number;
  stats: Array<{ name: string; age: number | null }>;
};

type PlaylistStatus = {
  time: number;
  playlists: Array<{ name: string; age: number | null }>;
};

const REFRESH_MS = 60_000;

const PLAYLIST_LABELS: Record<string, string> = {
  "daily-jams": "Daily Jams",
  "weekly-jams": "Weekly Jams",
  "weekly-exploration": "Weekly Exploration",
};

/** Longest first, so "this_week" wins over "week". */
const RANGE_KEYS = [...STATS_RANGES.map((r) => r.key)].sort((a, b) => b.length - a.length);

function rangeOf(statName: string): string | null {
  return RANGE_KEYS.find((r) => statName.endsWith(`_${r}`)) ?? null;
}

export default function CurrentStatusPage() {
  const service = useLB(
    ["service-status"],
    (api) => apiGet<ServiceStatus>(`${api.APIBaseURI}/status/service-status`),
    { refreshInterval: REFRESH_MS }
  );
  const playlists = useLB(
    ["playlist-status"],
    (api) => apiGet<PlaylistStatus>(`${api.APIBaseURI}/status/playlist-status`),
    { refreshInterval: REFRESH_MS }
  );

  const s = service.data;

  return (
    <Page
      title="Current status"
      subtitle={
        s ? `How fresh ListenBrainz's data is. Last checked ${fmtWhen(s.time)}, refreshed every minute.` : "How fresh ListenBrainz's data is."
      }
    >
      {service.isLoading ? (
        <Panel>
          <Loading label="Checking the service" />
        </Panel>
      ) : null}
      {service.error ? (
        <Panel>
          <ErrorNote error={service.error} onRetry={() => service.mutate()} />
        </Panel>
      ) : null}
      {s ? (
        <KpiStrip>
          <Kpi label="Listens waiting to be processed" value={fmtInt(s.incoming_listen_count)} />
          <Kpi label="Latest dump" value={fmtAge(s.dump_age)} />
          <Kpi label="Oldest user statistics" value={fmtAge(s.stats_age)} />
          <Kpi label="Oldest sitewide statistics" value={fmtAge(s.sitewide_stats_age)} />
        </KpiStrip>
      ) : null}

      <div className="grid gap-[14px] md:grid-cols-2">
        <Panel title="Playlists">
          {playlists.isLoading ? <SkeletonRows rows={3} cover={false} pitch={44} /> : null}
          {playlists.error ? <ErrorNote error={playlists.error} onRetry={() => playlists.mutate()} /> : null}
          {playlists.data ? (
            playlists.data.playlists.length ? (
              <ul className="flex flex-col divide-y divide-[#1f1f1f] text-[14px]">
                {playlists.data.playlists.map((p) => (
                  <li key={p.name} className="flex items-center justify-between gap-3 py-2.5">
                    <span>{PLAYLIST_LABELS[p.name] ?? p.name}</span>
                    <span className="num text-ink-2">{fmtAge(p.age)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No playlist status is available yet.</Empty>
            )
          ) : null}
        </Panel>

        <Panel title="Statistics by range" aside={s ? <span>Age of the oldest and newest</span> : null}>
          {!s && service.isLoading ? <SkeletonRows rows={4} cover={false} pitch={44} /> : null}
          {s ? <StatsTable stats={s.stats} /> : null}
        </Panel>
      </div>
    </Page>
  );
}

function StatsTable({ stats }: { stats: ServiceStatus["stats"] }) {
  if (!stats.length) return <Empty>No statistics are monitored yet.</Empty>;

  const byRange = new Map<string, Array<number | null>>();
  for (const stat of stats) {
    const range = rangeOf(stat.name);
    if (!range) continue;
    byRange.set(range, [...(byRange.get(range) ?? []), stat.age]);
  }

  const rows = STATS_RANGES.filter((r) => byRange.has(r.key)).map((r) => {
    const ages = byRange.get(r.key) ?? [];
    const known = ages.filter((a): a is number => a != null);
    const missing = ages.length - known.length;
    return {
      key: r.key,
      label: r.label,
      total: ages.length,
      missing,
      oldest: known.length ? Math.max(...known) : null,
      newest: known.length ? Math.min(...known) : null,
    };
  });

  if (!rows.length) return <Empty>No statistics are monitored yet.</Empty>;

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[320px] text-left text-[14px]">
        <thead>
          <tr className="text-[12px] text-ink-3">
            <th scope="col" className="py-2 pr-3 font-normal">
              Range
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-normal">
              Stats
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-normal">
              Oldest
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              Newest
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1f1f1f]">
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row" className="py-2.5 pr-3 font-normal">
                {r.label}
              </th>
              <td className="num py-2.5 pr-3 text-right text-ink-2">
                {r.total - r.missing}/{r.total}
              </td>
              <td className="num py-2.5 pr-3 text-right">{fmtAge(r.oldest)}</td>
              <td className="num py-2.5 text-right text-ink-2">{fmtAge(r.newest)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-ink-3">The first number counts statistics that have been produced.</p>
    </div>
  );
}
