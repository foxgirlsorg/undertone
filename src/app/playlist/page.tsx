"use client";

import * as React from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { Input, TextField } from "@heroui/react";
import { useAuth } from "@/lib/auth";
import { useLB } from "@/lib/use-lb";
import { fmtDateLong } from "@/lib/format";
import { Empty, ErrorNote, Page, SkeletonRows, UserLink } from "@/components/ui";
import { Pager } from "@/components/playlists/pager";
import { playlistId } from "@/components/playlists/playlist-utils";

const PAGE_SIZE = 25;

/**
 * /playlist: signed-in users go to their own playlists. Everyone else gets a search over public playlists.
 */
export default function PlaylistIndexPage() {
  const { user } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (user) router.replace(`/user/${encodeURIComponent(user.name)}/playlists`);
  }, [user, router]);

  if (user === undefined || user) {
    return (
      <Page title="Playlists">
        <SkeletonRows rows={3} cover={false} />
      </Page>
    );
  }
  return <PublicPlaylistSearch />;
}

function PublicPlaylistSearch() {
  const [input, setInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);

  React.useEffect(() => {
    const t = setTimeout(() => {
      const q = input.trim();
      setQuery(q.length >= 3 ? q : "");
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const { data, error, isLoading, mutate } = useLB(
    query ? ["public-playlist-search", query, page] : null,
    (api) => api.searchPlaylists(query, PAGE_SIZE, page * PAGE_SIZE)
  );
  const rows = data?.playlists?.map((p) => p.playlist) ?? [];
  const total = data?.playlist_count ?? 0;

  return (
    <Page title="Playlists" subtitle="Search public playlists by name or description.">
      <TextField value={input} onChange={setInput}>
        <Input aria-label="Search public playlists" placeholder="Search public playlists (3+ letters)" />
      </TextField>

      <section className="rounded-[20px] bg-card px-[22px] py-2">
        {!query ? (
          <div className="py-3">
            <Empty>Type at least three letters to search.</Empty>
          </div>
        ) : error ? (
          <div className="py-3">
            <ErrorNote error={error} onRetry={() => mutate()} />
          </div>
        ) : isLoading || !data ? (
          <SkeletonRows rows={5} cover={false} />
        ) : rows.length === 0 ? (
          <div className="py-3">
            <Empty>No public playlists match “{query}”.</Empty>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-[#1f1f1f]">
              {rows.map((pl) => (
                <li key={playlistId(pl)} className="flex items-center gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <NextLink
                      href={`/playlist/${playlistId(pl)}`}
                      className="block truncate text-[14px] font-medium leading-5 hover:text-data"
                    >
                      {pl.title || "Untitled playlist"}
                    </NextLink>
                    <div className="truncate text-[12px] text-ink-3">
                      <UserLink name={pl.creator} /> · {fmtDateLong(pl.date)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
          </>
        )}
      </section>
    </Page>
  );
}
