"use client";

import { mbGet } from "@/components/entity/mb";
import * as React from "react";
import useSWR from "swr";
import { Button, Input, TextField, toast } from "@heroui/react";
import { useAuth } from "@/lib/auth";
import { ErrorNote, SkeletonRows } from "@/components/ui";
import { errorMessage } from "@/lib/use-lb";
import { recordingToJSPFTrack } from "./playlist-utils";

type MBRecording = {
  id: string;
  title: string;
  length?: number;
  "artist-credit"?: Array<{ name: string; joinphrase?: string }>;
  releases?: Array<{ title: string }>;
};

const artistOf = (r: MBRecording) =>
  (r["artist-credit"] ?? []).map((a) => `${a.name}${a.joinphrase ?? ""}`).join("") || "Unknown artist";

async function searchRecordings(q: string): Promise<MBRecording[]> {
  // Shared MusicBrainz queue: paced to 1 request/second with retries on 503 (their rate limit).
  const json = await mbGet<{ recordings?: MBRecording[] }>("recording", { query: q, limit: 8 });
  return json.recordings ?? [];
}

/** "Add a track": searches MusicBrainz recordings and appends the chosen one to the playlist. */
export function AddTrackField({ playlistMBID, onAdded }: { playlistMBID: string; onAdded: () => void }) {
  const { api, user } = useAuth();
  const [input, setInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [adding, setAdding] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 350);
    return () => clearTimeout(t);
  }, [input]);

  const { data, error, isLoading, mutate } = useSWR(
    query.length >= 2 ? ["mb-recording-search", query] : null,
    ([, q]) => searchRecordings(q),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const add = async (r: MBRecording) => {
    if (!user) return;
    setAdding(r.id);
    try {
      const track = recordingToJSPFTrack({
        id: r.id,
        title: r.title,
        length: r.length,
        artistName: artistOf(r),
        releaseTitle: r.releases?.[0]?.title,
      });
      await api.addPlaylistItems(user.token, playlistMBID, [track]);
      toast.success("Added track", { description: `${r.title} by ${artistOf(r)}` });
      setInput("");
      onAdded();
    } catch (e) {
      toast.danger("Couldn't add track", { description: errorMessage(e) });
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <TextField value={input} onChange={setInput}>
        <Input aria-label="Add a track: search MusicBrainz recordings" placeholder="Add a track: search by title or artist" />
      </TextField>
      {query.length >= 2 ? (
        <div className="rounded-[12px] bg-raised p-1">
          {error ? (
            <div className="p-2">
              <ErrorNote error={error} onRetry={() => mutate()} />
            </div>
          ) : isLoading || !data ? (
            <div className="p-2">
              <SkeletonRows rows={3} cover={false} pitch={40} />
            </div>
          ) : data.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-ink-3">No recordings match “{query}”.</p>
          ) : (
            <ul>
              {data.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-[10px] px-3 py-2 hover:bg-[#2f2f2f]">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{r.title}</div>
                    <div className="truncate text-[12px] text-ink-2">
                      {artistOf(r)}
                      {r.releases?.[0]?.title ? <span className="text-ink-3"> · {r.releases[0].title}</span> : null}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => add(r)}
                    isDisabled={!user || adding !== null}
                    isPending={adding === r.id}
                  >
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
