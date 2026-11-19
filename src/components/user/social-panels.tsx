"use client";

import * as React from "react";
import { Button } from "@heroui/react";
import { useLB } from "@/lib/use-lb";
import { fmtInt } from "@/lib/format";
import { ErrorNote, Empty, Panel, SkeletonRows, UserLink, cx } from "@/components/ui";
import { similarityPercent } from "@/components/user/data";

const PREVIEW = 10;

/** Shows the first 10 names, with a button to expand the rest. */
function ExpandableList({
  names,
  emptyText,
  renderItem,
}: {
  names: string[];
  emptyText: string;
  renderItem: (name: string, index: number) => React.ReactNode;
}) {
  const [all, setAll] = React.useState(false);
  if (names.length === 0) return <Empty>{emptyText}</Empty>;
  const shown = all ? names : names.slice(0, PREVIEW);
  return (
    <div>
      <ul className="flex flex-col">
        {shown.map((n, i) => (
          <li key={n} className="flex min-h-[40px] items-center">
            {renderItem(n, i)}
          </li>
        ))}
      </ul>
      {names.length > PREVIEW ? (
        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="tertiary" onPress={() => setAll((v) => !v)}>
            {all ? "Show fewer" : `View all ${fmtInt(names.length)}`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Two-way toggle: people this user follows, and people who follow them. */
export function FollowingFollowersPanel({ name }: { name: string }) {
  const [tab, setTab] = React.useState<"following" | "followers">("following");
  const following = useLB(["following", name], (api) => api.getFollowingForUser(name));
  const followers = useLB(["followers", name], (api) => api.getFollowersOfUser(name));

  const followingNames = following.data?.following ?? [];
  const followerNames = followers.data?.followers ?? [];
  const current = tab === "following" ? following : followers;
  const names = tab === "following" ? followingNames : followerNames;

  const toggle = (key: "following" | "followers", label: string, count?: number) => (
    <button
      type="button"
      aria-pressed={tab === key}
      onClick={() => setTab(key)}
      className={cx(
        "h-8 rounded-full px-3 text-[13px] transition-colors",
        tab === key ? "bg-white font-medium text-black" : "text-[#bbb] hover:bg-[#1c1c1c] hover:text-white"
      )}
    >
      {label}
      {count != null ? <span className="num ml-1.5 opacity-70">{fmtInt(count)}</span> : null}
    </button>
  );

  return (
    <Panel>
      <div className="mb-4 flex gap-1">
        {toggle("following", "Following", following.data ? followingNames.length : undefined)}
        {toggle("followers", "Followers", followers.data ? followerNames.length : undefined)}
      </div>
      {current.isLoading ? (
        <SkeletonRows rows={4} cover={false} pitch={40} />
      ) : current.error ? (
        <ErrorNote error={current.error} onRetry={() => current.mutate()} />
      ) : (
        <ExpandableList
          names={names}
          emptyText={tab === "following" ? `${name} is not following anyone yet.` : `${name} has no followers yet.`}
          renderItem={(n) => <UserLink name={n} avatar />}
        />
      )}
    </Panel>
  );
}

/** Users with a similar listening history, each with a 2px similarity bar. The top one is the data colour. */
export function SimilarUsersPanel({ name }: { name: string }) {
  const similar = useLB(["similar-users", name], (api) => api.getSimilarUsersForUser(name));
  const rows = similar.data?.payload ?? [];

  return (
    <Panel title="Similar listeners">
      {similar.isLoading ? (
        <SkeletonRows rows={4} cover={false} pitch={44} />
      ) : similar.error ? (
        <ErrorNote error={similar.error} onRetry={() => similar.mutate()} />
      ) : rows.length === 0 ? (
        <Empty>No similar listeners yet. This fills in once more listens are submitted.</Empty>
      ) : (
        <SimilarList rows={rows} />
      )}
    </Panel>
  );
}

function SimilarList({ rows }: { rows: Array<{ user_name: string; similarity: number }> }) {
  const [all, setAll] = React.useState(false);
  const shown = all ? rows : rows.slice(0, PREVIEW);
  return (
    <div>
      <ul className="flex flex-col gap-1">
        {shown.map((r, i) => {
          const width = Math.max(0, Math.min(1, r.similarity)) * 100;
          return (
            <li key={r.user_name} className="py-1.5">
              <div className="flex items-center justify-between gap-3">
                <UserLink name={r.user_name} avatar />
                <span className="num text-[13px] text-ink-2">{similarityPercent(r.similarity)}</span>
              </div>
              <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-[#2a2a2a]" aria-hidden>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${width}%`, background: i === 0 ? "var(--data)" : "#6b6b6b" }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {rows.length > PREVIEW ? (
        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="tertiary" onPress={() => setAll((v) => !v)}>
            {all ? "Show fewer" : `View all ${fmtInt(rows.length)}`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
