"use client";

import * as React from "react";
import { Button, Input, Label, Modal, TextField, toast } from "@heroui/react";
import { useAuth } from "@/lib/auth";
import { useLB } from "@/lib/use-lb";
import { getArtistName, getRecordingMSID, getTrackName } from "@/lib/listen";
import { fmtDuration } from "@/lib/format";
import { Empty, ErrorNote, Loading } from "@/components/ui";
import { ModalShell, TrackRow, errorText, trackLabel, type ListenModalProps } from "./shared";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** A pasted MusicBrainz recording link or MBID becomes an exact `rid:` lookup; anything else is a text search. */
function toMBQuery(input: string): string {
  const uuid = input.match(UUID_RE)?.[0];
  return uuid ? `rid:${uuid}` : input;
}

export function LinkMBModal({ open, listen, onClose, onDone }: ListenModalProps) {
  return (
    <ModalShell open={open} onClose={onClose} title="Link with MusicBrainz" wide>
      <LinkMBForm listen={listen} onClose={onClose} onDone={onDone} />
    </ModalShell>
  );
}

function LinkMBForm({ listen, onClose, onDone }: Omit<ListenModalProps, "open">) {
  const { api, user } = useAuth();
  const initial = [getTrackName(listen), getArtistName(listen)].filter(Boolean).join(" ");
  const [query, setQuery] = React.useState(initial);
  const [term, setTerm] = React.useState(initial);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const search = useLB<TrackTypeSearchResult>(term.trim() ? ["mb-recording-search", term.trim()] : null, (a) =>
    a.recordingLookup(toMBQuery(term.trim()), 0, 10)
  );
  const recordings = search.data?.recordings ?? [];
  const msid = getRecordingMSID(listen);
  const canLink = !!user && !!msid && !!selected && !busy;

  const submitSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSelected(null);
    if (q === term) void search.mutate();
    else setTerm(q);
  };

  const link = async () => {
    if (!user || !msid || !selected) return;
    setBusy(true);
    try {
      await api.submitMBIDMapping(user.token, msid, selected);
      toast.success("Listen linked to MusicBrainz", { description: trackLabel(listen) });
      onDone();
    } catch (err) {
      toast.danger("Couldn't link this listen", { description: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal.Body className="flex flex-col gap-4">
        <TrackRow listen={listen} />
        <p className="text-[14px] text-ink-2">
          Pick the MusicBrainz recording this listen was. Paste a MusicBrainz recording link or id to look it up
          directly.
        </p>
        {msid ? null : (
          <p className="text-[14px] text-negative">This listen has no recording id, so it can’t be linked.</p>
        )}

        <form onSubmit={submitSearch} className="flex items-end gap-2">
          <TextField value={query} onChange={setQuery} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label>Search MusicBrainz</Label>
            <Input placeholder="Track and artist, or a recording link" className="h-10" />
          </TextField>
          <Button type="submit" variant="secondary" isDisabled={!query.trim()}>
            Search
          </Button>
        </form>

        {search.isLoading ? (
          <Loading label="Searching MusicBrainz" />
        ) : search.error ? (
          <ErrorNote error={search.error} onRetry={() => search.mutate()} />
        ) : recordings.length === 0 ? (
          <Empty>No recordings match. Try a shorter title or just the artist.</Empty>
        ) : (
          <ul className="flex max-h-[300px] flex-col gap-0.5 overflow-y-auto">
            {recordings.map((r) => {
              const credit = r["artist-credit"].map((c) => `${c.name}${c.joinphrase ?? ""}`).join("");
              const release = r.releases?.[0]?.title;
              const meta = [release, r.length ? fmtDuration(r.length) : null].filter(Boolean).join(" · ");
              const isSelected = selected === r.id;
              return (
                <li key={r.id}>
                  <Button
                    variant={isSelected ? "secondary" : "ghost"}
                    fullWidth
                    aria-pressed={isSelected}
                    onPress={() => setSelected(r.id)}
                    className="h-auto min-h-[44px] justify-start px-2 py-2 text-left"
                  >
                    <span className="flex min-w-0 flex-1 flex-col items-start">
                      <span className="max-w-full truncate text-[14px] font-medium">{r.title}</span>
                      <span className="max-w-full truncate text-[13px] text-ink-2">
                        {credit}
                        {meta ? ` · ${meta}` : ""}
                      </span>
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="tertiary" onPress={onClose}>
          Cancel
        </Button>
        <Button onPress={link} isDisabled={!canLink}>
          {busy ? "Linking…" : "Link recording"}
        </Button>
      </Modal.Footer>
    </>
  );
}
