"use client";

import * as React from "react";
import { Button } from "@heroui/react";
import { Page, Panel, Empty, ErrorNote, SkeletonRows, SignInPrompt, cx } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useLB } from "@/lib/use-lb";
import { fmtInt } from "@/lib/format";
import { Segmented, ToggleChip } from "@/components/explore/segmented";
import { ReleaseTile } from "@/components/explore/release-tile";
import {
  FRESH_DAY_OPTIONS,
  RELEASE_CATEGORIES,
  SORT_LABELS,
  dedupeReleases,
  groupReleases,
  releaseCategory,
  releasesFromResponse,
  type FreshDays,
  type FreshSort,
  type ReleaseCategory,
} from "@/components/explore/fresh-releases";

type Source = "all" | "mine";

export default function FreshReleasesPage() {
  const { user } = useAuth();
  const [source, setSource] = React.useState<Source>("all");
  const [days, setDays] = React.useState<FreshDays>(14);
  const [past, setPast] = React.useState(true);
  const [future, setFuture] = React.useState(true);
  const [sort, setSort] = React.useState<FreshSort>("release_date");
  const [types, setTypes] = React.useState<ReleaseCategory[]>([]);

  const mine = source === "mine";
  const sortOptions: FreshSort[] = mine
    ? ["release_date", "artist_credit_name", "release_name", "confidence"]
    : ["release_date", "artist_credit_name", "release_name"];

  const { data, error, isLoading, mutate } = useLB(
    mine && !user ? null : ["fresh-releases", source, days, past, future, sort],
    async (api, u) => {
      if (mine) {
        if (!u) return [] as FreshReleaseItem[];
        return releasesFromResponse(await api.fetchUserFreshReleases(u.name, days, past, future, sort));
      }
      return releasesFromResponse(await api.fetchSitewideFreshReleases(days, past, future, sort));
    }
  );

  const all = React.useMemo(() => dedupeReleases(data ?? []), [data]);
  const counts = React.useMemo(() => {
    const c: Record<ReleaseCategory, number> = { Album: 0, Single: 0, EP: 0, Other: 0 };
    for (const r of all) c[releaseCategory(r)] += 1;
    return c;
  }, [all]);
  const shown = React.useMemo(
    () => (types.length ? all.filter((r) => types.includes(releaseCategory(r))) : all),
    [all, types]
  );
  // A week can hold ~2,000 releases: render them in pages of 60 so the page stays light.
  const PAGE = 60;
  const filterKey = `${source}|${days}|${past}|${future}|${sort}|${types.join(",")}`;
  const [limit, setLimit] = React.useState(PAGE);
  const [limitKey, setLimitKey] = React.useState(filterKey);
  if (limitKey !== filterKey) {
    setLimitKey(filterKey);
    setLimit(PAGE);
  }
  const groups = React.useMemo(() => groupReleases(sort, shown.slice(0, limit)), [sort, shown, limit]);

  const toggleType = (t: ReleaseCategory) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <Page
      title="Fresh releases"
      subtitle="New and upcoming releases from the ListenBrainz archive, filtered and sorted however you like."
    >
      <div className="flex flex-col gap-[14px]">
        <Segmented<Source>
          label="Releases"
          value={source}
          onChange={(v) => {
            setSource(v);
            if (v === "all" && sort === "confidence") setSort("release_date");
            setTypes([]);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "mine", label: "For you" },
          ]}
        />

        {mine && !user ? <SignInPrompt what="see fresh releases picked for you" /> : null}

        <Panel>
          <div className="flex flex-col gap-4">
            <FilterRow label="Window">
              <Segmented<string>
                label="Window"
                value={String(days)}
                onChange={(v) => setDays(Number(v) as FreshDays)}
                options={FRESH_DAY_OPTIONS.map((d) => ({ value: String(d), label: `${d} days` }))}
              />
            </FilterRow>

            <FilterRow label="Show">
              <ToggleChip pressed={past} onPressedChange={() => setPast((v) => !v)}>
                Already released
              </ToggleChip>
              <ToggleChip pressed={future} onPressedChange={() => setFuture((v) => !v)}>
                Upcoming
              </ToggleChip>
            </FilterRow>

            <FilterRow label="Type">
              {RELEASE_CATEGORIES.map((t) => (
                <ToggleChip key={t} pressed={types.includes(t)} onPressedChange={() => toggleType(t)}>
                  {t}
                  <span className="num text-ink-3">{fmtInt(counts[t])}</span>
                </ToggleChip>
              ))}
            </FilterRow>

            <FilterRow label="Sort">
              <Segmented<FreshSort>
                label="Sort by"
                value={sort}
                onChange={setSort}
                options={sortOptions.map((s) => ({ value: s, label: SORT_LABELS[s] }))}
              />
            </FilterRow>
          </div>
        </Panel>

        {mine && !user ? null : isLoading ? (
          <Panel>
            <SkeletonRows rows={4} cover={false} pitch={56} />
          </Panel>
        ) : error ? (
          <ErrorNote error={error} onRetry={() => mutate()} />
        ) : all.length === 0 ? (
          <Empty>No releases in this window. Try a longer window or include upcoming releases.</Empty>
        ) : shown.length === 0 ? (
          <Empty>
            None of the {fmtInt(all.length)} releases match these types. Clear the type filter to see them.
          </Empty>
        ) : (
          <>
            <p className="num text-[13px] text-ink-3" aria-live="polite">
              {shown.length > limit ? `Showing ${fmtInt(limit)} of ` : ""}
              {fmtInt(shown.length)} {types.length ? `of ${fmtInt(all.length)} ` : ""}releases
            </p>
            {groups.map((g) => (
              <section key={g.key} aria-label={g.label} className="flex flex-col gap-3">
                <h2 className={cx("text-[16px] font-medium leading-6")}>{g.label}</h2>
                <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-3 lg:grid-cols-5">
                  {g.items.map((r) => (
                    <ReleaseTile key={`${r.release_mbid}-${r.release_group_mbid}`} release={r} />
                  ))}
                </div>
              </section>
            ))}
            {shown.length > limit ? (
              <div className="flex justify-center pt-2">
                <Button variant="secondary" onPress={() => setLimit((l) => l + PAGE)}>
                  Show {fmtInt(Math.min(PAGE, shown.length - limit))} more
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </Page>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-16 flex-none text-[13px] text-ink-3">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
