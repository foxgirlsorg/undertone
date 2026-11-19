"use client";

import * as React from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, ListBox, Select, TextField } from "@heroui/react";
import { useAuth } from "@/lib/auth";
import { useLB } from "@/lib/use-lb";
import { fmtInt, fmtWhen, plural } from "@/lib/format";
import { Empty, ErrorNote, NavTabs, Pill, SkeletonRows, UserAvatar, cx } from "@/components/ui";
import {
  collaboratorsOf,
  createdTime,
  fetchAllUserPlaylists,
  isPlaylistPublic,
  modifiedTime,
  playlistId,
  searchAllUserPlaylists,
} from "./playlist-utils";
import { CreateOrEditPlaylistModal } from "./create-or-edit-playlist-modal";
import { ImportPlaylistModal } from "./import-playlist-modal";
import { Pager } from "./pager";

const PAGE_SIZE = 25;
type SortKey = "created" | "modified" | "title";
const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: "created", label: "Date created" },
  { id: "modified", label: "Date modified" },
  { id: "title", label: "Title" },
];

/**
 * A user's playlists as rows: the "Created" list (/user/[u]/playlists) or the "Collaborations"
 * list (/user/[u]/collaborations). Sorting and search run on the full list; paging is 25.
 */
export function PlaylistsView({ username, mode }: { username: string; mode: "created" | "collaborations" }) {
  const { user } = useAuth();
  const router = useRouter();
  const isSelf = !!user && user.name === username;
  const [input, setInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("created");
  const [page, setPage] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);

  // Debounce typing; searches start at three characters (the server's minimum).
  React.useEffect(() => {
    const t = setTimeout(() => {
      const q = input.trim();
      setQuery(q.length >= 3 ? q : "");
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const serverSearch = mode === "created" && query.length >= 3;
  const { data, error, isLoading, mutate } = useLB(
    ["user-playlists", username, mode, serverSearch ? query : ""],
    async (a, u) =>
      serverSearch
        ? searchAllUserPlaylists(a, username, query)
        : fetchAllUserPlaylists(a, username, u?.token, { collaborator: mode === "collaborations" })
  );

  const rows = React.useMemo(() => {
    let list = (data ?? []).map((o) => o.playlist);
    // Collaborations have no server search, so filter the list by title or description.
    if (mode === "collaborations" && query) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || (p.annotation ?? "").toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "created") sorted.sort((a, b) => createdTime(b) - createdTime(a));
    if (sort === "modified") sorted.sort((a, b) => modifiedTime(b) - modifiedTime(a));
    return sorted;
  }, [data, mode, query, sort]);

  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const tabs = [
    { key: "created", href: `/user/${encodeURIComponent(username)}/playlists`, label: "Created" },
    { key: "collaborations", href: `/user/${encodeURIComponent(username)}/collaborations`, label: "Collaborations" },
  ];

  return (
    <div className="flex flex-col gap-[14px] pb-2">
      <div className="flex flex-wrap items-end justify-between gap-3 pt-6">
        <NavTabs items={tabs} active={mode} />
        {isSelf && mode === "created" ? (
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <Button variant="secondary" onPress={() => setImportOpen(true)}>
              Import
            </Button>
            <Button onPress={() => setCreateOpen(true)}>New playlist</Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <TextField value={input} onChange={setInput} className="min-w-[220px] flex-1">
          <Input aria-label="Search playlists" placeholder="Search playlists (3+ letters)" />
        </TextField>
        <Select
          aria-label="Sort playlists"
          className="w-[190px]"
          selectedKey={sort}
          onSelectionChange={(k) => {
            setSort(String(k) as SortKey);
            setPage(0);
          }}
        >
          <Select.Trigger className="min-h-10">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {SORTS.map((s) => (
                <ListBox.Item key={s.id} id={s.id} textValue={s.label}>
                  {s.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <section className="rounded-[20px] bg-card px-[22px] py-2">
        {error ? (
          <div className="py-3">
            <ErrorNote error={error} onRetry={() => mutate()} />
          </div>
        ) : isLoading || !data ? (
          <SkeletonRows rows={5} cover={false} pitch={64} />
        ) : rows.length === 0 ? (
          <div className="py-3">
            <Empty>
              {query
                ? `No playlists match “${query}”.`
                : mode === "collaborations"
                  ? "No collaborations yet."
                  : "No playlists yet."}
            </Empty>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-[#1f1f1f]">
              {pageRows.map((pl) => (
                <PlaylistRow key={playlistId(pl)} playlist={pl} />
              ))}
            </ul>
            <Pager page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
          </>
        )}
      </section>

      {isSelf ? (
        <>
          <CreateOrEditPlaylistModal
            isOpen={createOpen}
            onOpenChange={setCreateOpen}
            onSaved={(id) => router.push(`/playlist/${id}`)}
          />
          <ImportPlaylistModal
            isOpen={importOpen}
            onOpenChange={setImportOpen}
            username={username}
            onImported={(id) => router.push(`/playlist/${id}`)}
          />
        </>
      ) : null}
    </div>
  );
}

function PlaylistRow({ playlist }: { playlist: JSPFPlaylist }) {
  const id = playlistId(playlist);
  const isPublic = isPlaylistPublic(playlist);
  const collaborators = collaboratorsOf(playlist);
  const count = playlist.track?.length;
  return (
    <li className="flex items-center gap-4 py-3">
      <div className="min-w-0 flex-1">
        <NextLink href={`/playlist/${id}`} className="block truncate text-[14px] font-medium leading-5 hover:text-data">
          {playlist.title || "Untitled playlist"}
        </NextLink>
        <div className="num mt-0.5 truncate text-[12px] text-ink-3">
          {count != null ? plural(count, "track") : "Playlist"} · modified {fmtWhen(modifiedTime(playlist))} · by{" "}
          {playlist.creator}
        </div>
      </div>
      <div className="hidden flex-none items-center sm:flex" aria-label={`Collaborators: ${collaborators.join(", ") || "none"}`}>
        {collaborators.slice(0, 3).map((c, i) => (
          <span key={c} className={cx("rounded-full ring-2 ring-[#111]", i > 0 && "-ml-2")} title={c}>
            <UserAvatar name={c} size={24} />
          </span>
        ))}
        {collaborators.length > 3 ? (
          <span className="num -ml-2 text-[12px] text-ink-3">+{fmtInt(collaborators.length - 3)}</span>
        ) : null}
      </div>
      <Pill tone={isPublic ? "positive" : "neutral"}>{isPublic ? "Public" : "Private"}</Pill>
    </li>
  );
}

