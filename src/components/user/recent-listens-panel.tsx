"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { useLB } from "@/lib/use-lb";
import { useListFeedback } from "@/lib/feedback";
import { fmtDateLong } from "@/lib/format";
import { ErrorNote, Empty, Panel, SkeletonRows } from "@/components/ui";
import { ListenCard } from "@/components/listen/listen-card";
import { fetchListensPage, listenRowKey } from "@/components/user/data";

/** Recent listens with the playing-now listen on top, Newer / Older / date paging. */
export function RecentListensPanel({
  name,
  minTs,
  maxTs,
}: {
  name: string;
  minTs?: number;
  maxTs?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [removed, setRemoved] = React.useState<Set<string>>(() => new Set());

  const page = useLB(
    ["user-listens", name, minTs ?? 0, maxTs ?? 0],
    (api) => fetchListensPage(api, name, minTs, maxTs),
    { keepPreviousData: true }
  );
  const nowQuery = useLB(["playing-now", name], (api) => api.getPlayingNowForUser(name), {
    refreshInterval: 30_000,
  });

  const nowData = nowQuery.data;
  const nowListen = React.useMemo(
    () => (nowData ? ({ ...nowData, playing_now: true } as Listen) : undefined),
    [nowData]
  );

  const listens = page.data?.listens ?? [];
  const visible = listens.filter((l) => !removed.has(listenRowKey(l)));
  const fb = useListFeedback(nowListen ? [nowListen, ...visible] : visible);

  const latest = page.data?.latestListenTs ?? 0;
  const oldest = page.data?.oldestListenTs ?? 0;
  const newest = listens[0]?.listened_at;
  const tail = listens[listens.length - 1]?.listened_at;

  const go = (params?: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onDate = (value: string) => {
    if (!value) return;
    // Local midnight of the chosen day, then the start of the next day as the exclusive upper bound.
    const next = new Date(`${value}T00:00:00`);
    next.setDate(next.getDate() + 1);
    go({ max_ts: String(Math.round(next.getTime() / 1000)) });
  };

  const newestDisabled = !listens.length || (newest ?? 0) >= latest;
  const newerDisabled = !newest || newest >= latest;
  const olderDisabled = !tail || tail <= oldest;
  const oldestDisabled = !tail || tail <= oldest;

  const rangeAside =
    listens.length > 0 && tail != null && newest != null ? (
      <span>
        Listens for {fmtDateLong(tail)}
        {fmtDateLong(tail) !== fmtDateLong(newest) ? ` – ${fmtDateLong(newest)}` : ""}
      </span>
    ) : undefined;

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const isNavigated = minTs != null || maxTs != null;

  return (
    <Panel title="Recent listens" aside={rangeAside}>
      {page.isLoading && !page.data ? (
        <SkeletonRows rows={6} />
      ) : (
        <>
          {page.error ? (
            <div className="mb-2">
              <ErrorNote error={page.error} onRetry={() => page.mutate()} />
            </div>
          ) : null}
          {nowQuery.error && !nowListen ? (
            <div className="mb-2">
              <ErrorNote error={nowQuery.error} onRetry={() => nowQuery.mutate()} />
            </div>
          ) : null}

          {listens.length === 0 ? (
            <Empty>
              {isNavigated
                ? "No listens in this range. Jump to the newest listens to continue."
                : "No listens yet. Connect a music service or submit listens with your token."}
            </Empty>
          ) : null}

          {nowListen || visible.length > 0 ? (
            <div className="flex flex-col">
              {nowListen ? (
                <ListenCard
                  key="playing-now"
                  listen={nowListen}
                  context={visible}
                  feedback={fb.get(nowListen)}
                  canDelete={false}
                />
              ) : null}
              {visible.map((l) => (
                <ListenCard
                  key={listenRowKey(l)}
                  listen={l}
                  context={visible}
                  feedback={fb.get(l)}
                  onDone={(kind) => {
                    if (kind === "delete") setRemoved((prev) => new Set(prev).add(listenRowKey(l)));
                  }}
                />
              ))}
            </div>
          ) : null}

          {listens.length > 0 ? (
            <nav
              aria-label="Listen pages"
              className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#1f1f1f] pt-4"
            >
              <div className="flex items-center gap-2">
                <Button size="sm" variant="tertiary" isDisabled={newestDisabled} onPress={() => go()}>
                  Newest
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={newerDisabled}
                  onPress={() => go({ min_ts: String(newest) })}
                >
                  ← Newer
                </Button>
              </div>

              <label className="flex items-center gap-2 text-[13px] text-ink-3">
                <span>Go to date</span>
                <input
                  type="date"
                  aria-label="Go to date"
                  max={todayIso}
                  min={oldest ? new Date(oldest * 1000).toLocaleDateString("en-CA") : undefined}
                  onChange={(e) => onDate(e.target.value)}
                  className="h-8 rounded-full bg-[#1c1c1c] px-3 text-[13px] text-white [color-scheme:dark]"
                />
              </label>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={olderDisabled}
                  onPress={() => go({ max_ts: String(tail) })}
                >
                  Older →
                </Button>
                <Button
                  size="sm"
                  variant="tertiary"
                  isDisabled={oldestDisabled}
                  onPress={() => go({ min_ts: String(oldest - 1) })}
                >
                  Oldest
                </Button>
              </div>
            </nav>
          ) : null}

          {listens.length > 0 && listens.length < 25 ? (
            <p className="mt-3 text-center text-[13px] text-ink-3">No more listens to show.</p>
          ) : null}
        </>
      )}
      {page.isValidating && page.data ? <span className="sr-only">Updating listens</span> : null}
    </Panel>
  );
}
