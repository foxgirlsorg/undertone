"use client";

import * as React from "react";
import { Button, Input, Label, Modal, TextField, toast } from "@heroui/react";
import { useAuth } from "@/lib/auth";
import { useLB } from "@/lib/use-lb";
import { getArtistName, getRecordingMBID, getReleaseName, getTrackName } from "@/lib/listen";
import { Empty, ErrorNote, Loading, SwitchRow } from "@/components/ui";
import { ModalShell, TrackRow, errorText, trackLabel, type ListenModalProps } from "./shared";

const PLAYLIST_EXTENSION = "https://musicbrainz.org/doc/jspf#playlist";

type PlaylistRow = { mbid: string; title: string; collaborative: boolean };

export function AddToPlaylistModal({ open, listen, onClose, onDone }: ListenModalProps) {
  return (
    <ModalShell open={open} onClose={onClose} title="Add to playlist" wide>
      <AddToPlaylistForm listen={listen} onClose={onClose} onDone={onDone} />
    </ModalShell>
  );
}

/** Playlists store tracks by recording MBID, so the listen must be linked first. */
function toJSPFTrack(listen: Listen, mbid: string): JSPFTrack {
  const album = getReleaseName(listen);
  return {
    identifier: [`https://musicbrainz.org/recording/${mbid}`],
    title: getTrackName(listen),
    creator: getArtistName(listen),
    ...(album ? { album } : {}),
  };
}

function toRows(list: JSPFObject[] | undefined, collaborative: boolean): PlaylistRow[] {
  return (list ?? []).map(({ playlist }) => ({
    mbid: playlist.identifier.split("/").pop() ?? "",
    title: playlist.title || "Untitled playlist",
    collaborative,
  }));
}

function AddToPlaylistForm({ listen, onClose, onDone }: Omit<ListenModalProps, "open">) {
  const { api, user } = useAuth();
  const own = useLB(user ? ["user-playlists", "own"] : null, (a, u) =>
    a.getUserPlaylists(u?.name ?? "", u?.token, 0, 100)
  );
  const collab = useLB(user ? ["user-playlists", "collaborator"] : null, (a, u) =>
    a.getUserPlaylists(u?.name ?? "", u?.token, 0, 100, false, true)
  );

  const [filter, setFilter] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [isPublic, setIsPublic] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);

  const mbid = getRecordingMBID(listen);

  // Own playlists win over collaborative duplicates.
  const playlists = React.useMemo(() => {
    const byMbid = new Map<string, PlaylistRow>();
    for (const row of [...toRows(own.data?.playlists, false), ...toRows(collab.data?.playlists, true)]) {
      if (row.mbid && !byMbid.has(row.mbid)) byMbid.set(row.mbid, row);
    }
    return [...byMbid.values()];
  }, [own.data, collab.data]);

  const needle = filter.trim().toLowerCase();
  const shown = needle ? playlists.filter((p) => p.title.toLowerCase().includes(needle)) : playlists;
  const loading = own.isLoading || collab.isLoading;
  const loadError = own.error ?? collab.error;

  const addTo = async (row: PlaylistRow) => {
    if (!user || !mbid) return;
    setBusy(row.mbid);
    try {
      await api.addPlaylistItems(user.token, row.mbid, [toJSPFTrack(listen, mbid)]);
      toast.success(`Added to ${row.title}`, { description: trackLabel(listen) });
      onDone();
    } catch (err) {
      toast.danger("Couldn't add the track", { description: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const createPlaylist = async () => {
    const title = newName.trim();
    if (!user || !mbid || !title) return;
    setBusy("new");
    const payload = {
      playlist: {
        title,
        track: [toJSPFTrack(listen, mbid)],
        extension: { [PLAYLIST_EXTENSION]: { public: isPublic } },
      },
    } as JSPFObject;
    try {
      await api.createPlaylist(user.token, payload);
      toast.success(`Created ${isPublic ? "public" : "private"} playlist`, { description: title });
      onDone();
    } catch (err) {
      toast.danger("Couldn't create the playlist", { description: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  if (!mbid) {
    return (
      <>
        <Modal.Body className="flex flex-col gap-4">
          <TrackRow listen={listen} />
          <Empty>
            This listen isn’t linked to MusicBrainz yet, and playlists store tracks by MusicBrainz recording. Link it
            first, then add it.
          </Empty>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="tertiary" onPress={onClose}>
            Close
          </Button>
        </Modal.Footer>
      </>
    );
  }

  return (
    <>
      <Modal.Body className="flex flex-col gap-4">
        <TrackRow listen={listen} />

        {creating ? (
          <div className="flex flex-col gap-3 rounded-[12px] bg-raised p-3">
            <TextField value={newName} onChange={setNewName} isRequired className="flex flex-col gap-1.5">
              <Label>New playlist name</Label>
              <Input placeholder="Playlist name" className="h-10" />
            </TextField>
            <SwitchRow isSelected={isPublic} onChange={setIsPublic} label="Public playlist" />
          </div>
        ) : (
          <>
            {loading ? (
              <Loading label="Loading playlists" />
            ) : loadError ? (
              <ErrorNote
                error={loadError}
                onRetry={() => {
                  void own.mutate();
                  void collab.mutate();
                }}
              />
            ) : playlists.length === 0 ? (
              <Empty>You have no playlists yet. Create one below.</Empty>
            ) : (
              <>
                <TextField value={filter} onChange={setFilter} className="flex flex-col gap-1.5">
                  <Label className="sr-only">Find a playlist</Label>
                  <Input placeholder="Find a playlist" className="h-10" />
                </TextField>
                <ul className="flex max-h-[260px] flex-col gap-0.5 overflow-y-auto">
                  {shown.length === 0 ? (
                    <li className="px-2 py-2 text-[14px] text-ink-3">No playlists match “{filter.trim()}”.</li>
                  ) : (
                    shown.map((row) => (
                      <li key={row.mbid}>
                        <Button
                          variant="ghost"
                          fullWidth
                          isDisabled={busy !== null}
                          onPress={() => addTo(row)}
                          className="h-auto min-h-[44px] justify-start px-2 py-2 text-left"
                        >
                          <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                            <span className="truncate text-[14px]">{row.title}</span>
                            {row.collaborative ? (
                              <span className="flex-none text-[12px] text-ink-3">Collaborative</span>
                            ) : null}
                          </span>
                        </Button>
                      </li>
                    ))
                  )}
                </ul>
              </>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        {creating ? (
          <>
            <Button variant="tertiary" onPress={() => setCreating(false)}>
              Back
            </Button>
            <Button onPress={createPlaylist} isDisabled={!newName.trim() || busy !== null}>
              {busy === "new" ? "Creating…" : "Create and add"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="tertiary" onPress={onClose}>
              Cancel
            </Button>
            <Button variant="secondary" onPress={() => setCreating(true)}>
              New playlist
            </Button>
          </>
        )}
      </Modal.Footer>
    </>
  );
}
