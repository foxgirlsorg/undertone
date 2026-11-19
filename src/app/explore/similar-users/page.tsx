"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Label, TextField } from "@heroui/react";
import { Page, Panel, Empty, ErrorNote, SkeletonRows, UserAvatar, UserLink, Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useLB } from "@/lib/use-lb";
import { fmtInt } from "@/lib/format";

export default function SimilarUsersPage() {
  return (
    <Suspense fallback={null}>
      <SimilarUsers />
    </Suspense>
  );
}

type SimilarUser = { user_name: string; similarity: number };

function SimilarUsers() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: me } = useAuth();
  const urlUser = searchParams.get("user")?.trim() || null;
  const subject = urlUser ?? me?.name ?? null;

  const [typed, setTyped] = React.useState("");
  // A comparison belongs to one subject: switching whose list we look at drops it.
  const [comparison, setComparison] = React.useState<{ subject: string | null; with: string } | null>(null);
  const compareWith = comparison && comparison.subject === subject ? comparison.with : null;
  const setCompareWith = (name: string | null) => setComparison(name ? { subject, with: name } : null);

  const list = useLB(subject ? ["similar-users", subject] : null, async (api) => {
    const res = await api.getSimilarUsersForUser(subject as string);
    return (res?.payload ?? []) as SimilarUser[];
  });

  const compare = useLB(subject && compareWith ? ["similar-to", subject, compareWith] : null, async (api) => {
    const res = await api.getSimilarityBetweenUsers(subject as string, compareWith as string);
    return res?.payload?.similarity ?? null;
  });

  const rows = list.data ?? [];
  const max = Math.max(0, ...rows.map((r) => r.similarity));

  const lookup = (e: React.FormEvent) => {
    e.preventDefault();
    const name = typed.trim();
    if (name) router.push(`/explore/similar-users?user=${encodeURIComponent(name)}`);
  };

  return (
    <Page
      title="Similar users"
      subtitle="People whose listening overlaps most with theirs. Useful for finding someone to follow, or spotting odd accounts."
    >
      {!subject ? (
        <Panel title="Whose listens?">
          <form onSubmit={lookup} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <TextField value={typed} onChange={setTyped} name="user" className="w-full sm:max-w-80">
              <Label>ListenBrainz username</Label>
              <Input autoComplete="off" spellCheck={false} placeholder="username" />
            </TextField>
            <Button type="submit" variant="primary" isDisabled={!typed.trim()}>
              Show similar users
            </Button>
          </form>
        </Panel>
      ) : (
        <>
          <Panel
            title={`Similar to ${subject}`}
            aside={
              <div className="flex items-center gap-3">
                {urlUser && me && urlUser !== me.name ? (
                  <Button size="sm" variant="tertiary" onPress={() => router.push("/explore/similar-users")}>
                    Use my account
                  </Button>
                ) : null}
                <UserLink name={subject} />
              </div>
            }
          >
            {list.isLoading ? (
              <SkeletonRows rows={6} cover={false} pitch={52} />
            ) : list.error ? (
              <ErrorNote error={list.error} onRetry={() => list.mutate()} />
            ) : rows.length === 0 ? (
              <Empty>
                No similar users for {subject} yet. They need a longer listening history before they can be compared.
              </Empty>
            ) : (
              <ol className="flex flex-col">
                {rows.map((r, i) => (
                  <li
                    key={r.user_name}
                    className="flex min-h-[52px] items-center gap-3 rounded-[12px] px-2 py-1.5 hover:bg-[#161616]"
                  >
                    <span className="num w-6 flex-none text-right text-[13px] text-ink-3">{i + 1}</span>
                    <UserAvatar name={r.user_name} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">
                        <UserLink name={r.user_name} />
                      </div>
                      <div className="mt-1.5 h-1.5 w-full max-w-[360px] rounded-full bg-[#1f1f1f]" aria-hidden>
                        <div
                          className="h-full rounded-full bg-data"
                          style={{ width: `${max > 0 ? (r.similarity / max) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className="num w-16 flex-none text-right text-[13px]" aria-label={`Similarity ${r.similarity}`}>
                      {r.similarity.toFixed(3)}
                    </span>
                    <Button
                      size="sm"
                      variant="tertiary"
                      onPress={() => setCompareWith(r.user_name)}
                      aria-label={`Compare ${subject} with ${r.user_name}`}
                    >
                      Compare
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          {compareWith ? (
            <Panel
              title={`${subject} and ${compareWith}`}
              aside={
                <Button size="sm" variant="tertiary" onPress={() => setCompareWith(null)}>
                  Clear
                </Button>
              }
            >
              {compare.isLoading ? (
                <Loading label="Comparing" />
              ) : compare.error ? (
                <ErrorNote error={compare.error} onRetry={() => compare.mutate()} />
              ) : compare.data == null ? (
                <Empty>There is no similarity score between these two users yet.</Empty>
              ) : (
                <p className="text-[14px] text-ink-2">
                  Similarity{" "}
                  <span className="num font-medium text-white">{compare.data.toFixed(3)}</span>
                  {" "}· {fmtInt(rows.length)} similar users were found for {subject}.
                </p>
              )}
            </Panel>
          ) : null}
        </>
      )}
    </Page>
  );
}
