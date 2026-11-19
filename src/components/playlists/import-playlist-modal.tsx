"use client";

import * as React from "react";
import { Button, Modal, toast } from "@heroui/react";
import { useAuth } from "@/lib/auth";
import { LB_WEB_URL } from "@/lib/config";
import { PLAYLIST_EXT } from "./playlist-utils";

/** Accepts a JSPF document (.jspf or .json) and returns the object ready for createPlaylist. */
function parseJSPF(text: string, creator: string): JSPFObject {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  const pl = (json as { playlist?: Partial<JSPFPlaylist> })?.playlist;
  if (!pl || typeof pl !== "object") throw new Error("This is not a JSPF playlist: no 'playlist' object.");
  if (!pl.title || typeof pl.title !== "string") throw new Error("The playlist has no title.");
  const tracks = Array.isArray(pl.track) ? pl.track : [];
  const hasIds = tracks.every((t) => t && (typeof t.identifier === "string" || Array.isArray(t.identifier)));
  if (!hasIds) throw new Error("Some tracks have no MusicBrainz identifier, so they cannot be imported.");
  const fileExt = (pl.extension?.[PLAYLIST_EXT] ?? {}) as JSPFPlaylistExtension;
  return {
    playlist: {
      title: pl.title,
      annotation: pl.annotation ?? "",
      creator,
      identifier: "",
      date: "",
      track: tracks,
      extension: { [PLAYLIST_EXT]: { public: !!fileExt.public, collaborators: [] } },
    } as JSPFPlaylist,
  };
}

/**
 * Import a playlist from a JSPF file. Spotify, Apple Music and SoundCloud imports need the
 * ListenBrainz website's sign-in, so they are linked out.
 */
export function ImportPlaylistModal({
  isOpen,
  onOpenChange,
  username,
  onImported,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  onImported: (id: string) => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[480px]">
          <Modal.CloseTrigger />
          <ImportForm username={username} onImported={onImported} onOpenChange={onOpenChange} />
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function ImportForm({
  username,
  onImported,
  onOpenChange,
}: {
  username: string;
  onImported: (id: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { api, user } = useAuth();
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const importFile = async () => {
    if (!user || !file) return;
    setBusy(true);
    setError(null);
    try {
      const obj = parseJSPF(await file.text(), user.name);
      const id = await api.createPlaylist(user.token, obj);
      toast.success("Imported playlist", { description: obj.playlist.title });
      onImported(id);
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal.Header>
        <Modal.Heading>Import a playlist</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-4 text-[14px]">
        <p className="text-ink-2">Choose a .jspf or .json file exported from ListenBrainz or another service that writes JSPF.</p>
        <label className="flex flex-col gap-2">
          <span className="sr-only">JSPF file</span>
          <input
            type="file"
            accept=".jspf,.json"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
            className="block w-full text-[14px] text-ink-2 file:mr-3 file:rounded-full file:border-0 file:bg-raised file:px-4 file:py-2 file:text-white"
          />
        </label>
        {error ? <p role="alert" className="text-[13px] text-negative">{error}</p> : null}
        <div className="rounded-[12px] bg-raised p-3 text-[13px] text-ink-2">
          Spotify, Apple Music and SoundCloud playlists are imported on{" "}
          <a
            href={`${LB_WEB_URL}/user/${encodeURIComponent(username)}/playlists/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline-offset-2 hover:text-data hover:underline"
          >
            listenbrainz.org
          </a>
          , where those accounts are connected.
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button slot="close" variant="tertiary">
          Cancel
        </Button>
        <Button onPress={importFile} isDisabled={!file || busy} isPending={busy}>
          Import
        </Button>
      </Modal.Footer>
    </>
  );
}
