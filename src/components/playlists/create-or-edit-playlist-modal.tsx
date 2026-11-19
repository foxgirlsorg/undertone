"use client";

import * as React from "react";
import { Button, Input, Label, Modal, TextArea, TextField, toast } from "@heroui/react";
import { Xmark } from "@gravity-ui/icons";
import { useAuth } from "@/lib/auth";
import { cx, SwitchRow } from "@/components/ui";
import {
  PLAYLIST_EXT,
  getPlaylistExt,
  isOwner,
  playlistId,
} from "./playlist-utils";

export type CreateOrEditPlaylistModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set to edit an existing playlist (owner only). Leave unset to create one. */
  playlist?: JSPFPlaylist | null;
  /** Tracks to start a new playlist with. */
  initialTracks?: JSPFTrack[];
  /** Called with the playlist's MBID after a successful create or save. */
  onSaved: (id: string) => void;
};

/**
 * Create or edit a playlist: title, description, public switch, collaborators by username.
 * The form lives inside the dialog, so it resets every time the modal opens.
 */
export function CreateOrEditPlaylistModal(props: CreateOrEditPlaylistModalProps) {
  return (
    <Modal.Backdrop isOpen={props.isOpen} onOpenChange={props.onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[480px]">
          <Modal.CloseTrigger />
          <PlaylistForm {...props} />
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function PlaylistForm({ playlist, initialTracks, onSaved, onOpenChange }: CreateOrEditPlaylistModalProps) {
  const { api, user } = useAuth();
  const editing = !!playlist;
  const ext = getPlaylistExt(playlist);
  const [name, setName] = React.useState(playlist?.title ?? "");
  const [description, setDescription] = React.useState(playlist?.annotation ?? "");
  const [isPublic, setIsPublic] = React.useState(ext?.public ?? true);
  const [collaborators, setCollaborators] = React.useState<string[]>(ext?.collaborators ?? []);
  const [collaboratorInput, setCollaboratorInput] = React.useState("");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const addCollaborator = () => {
    const next = collaboratorInput.trim();
    if (!next) return;
    if (next === user?.name) {
      toast.danger("You are the owner of this playlist");
      return;
    }
    if (!collaborators.includes(next)) setCollaborators([...collaborators, next]);
    setCollaboratorInput("");
  };

  const save = async () => {
    if (!user) return;
    if (!name.trim()) {
      setNameError("Give the playlist a title.");
      return;
    }
    setNameError(null);
    setSaving(true);
    const collabs = collaborators.filter((c) => c !== user.name);
    try {
      if (playlist) {
        if (!isOwner(playlist, user.name)) throw new Error("Only the owner can change these details.");
        const id = playlistId(playlist);
        await api.editPlaylist(user.token, id, {
          playlist: {
            identifier: playlist.identifier,
            creator: playlist.creator,
            date: playlist.date,
            title: name.trim(),
            annotation: description.trim(),
            extension: {
              [PLAYLIST_EXT]: {
                ...ext,
                public: isPublic,
                collaborators: collabs,
                last_modified_at: new Date().toISOString(),
              },
            },
          } as unknown as JSPFPlaylist,
        } as JSPFObject);
        toast.success("Saved playlist", { description: name.trim() });
        onSaved(id);
      } else {
        const id = await api.createPlaylist(user.token, {
          playlist: {
            title: name.trim(),
            annotation: description.trim(),
            creator: user.name,
            identifier: "",
            date: "",
            track: initialTracks ?? [],
            extension: { [PLAYLIST_EXT]: { public: isPublic, collaborators: collabs } },
          },
        } as JSPFObject);
        toast.success(`Created ${isPublic ? "public" : "private"} playlist`, { description: name.trim() });
        onSaved(id);
      }
      onOpenChange(false);
    } catch (e) {
      toast.danger(editing ? "Couldn't save playlist" : "Couldn't create playlist", {
        description: (e as Error).message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal.Header>
        <Modal.Heading>{editing ? "Edit playlist" : "New playlist"}</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-4">
        <TextField value={name} onChange={(v) => { setName(v); setNameError(null); }} isRequired isInvalid={!!nameError}>
          <Label>Title</Label>
          <Input placeholder="Name your playlist" />
          {nameError ? <span className="text-[12px] text-negative">{nameError}</span> : null}
        </TextField>

        <TextField value={description} onChange={setDescription}>
          <Label>Description</Label>
          <TextArea rows={3} placeholder="What is this playlist for?" />
        </TextField>

        <SwitchRow isSelected={isPublic} onChange={setIsPublic} label="Make playlist public" />

        <div className="flex flex-col gap-2">
          <span className="text-[14px] font-medium">Collaborators</span>
          <div className="flex items-end gap-2">
            <TextField value={collaboratorInput} onChange={setCollaboratorInput} className="flex-1">
              <Input aria-label="ListenBrainz username" placeholder="ListenBrainz username" />
            </TextField>
            <Button variant="secondary" onPress={addCollaborator} isDisabled={!collaboratorInput.trim()}>
              Add
            </Button>
          </div>
          {collaborators.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="Collaborators">
              {collaborators.map((c) => (
                <li
                  key={c}
                  className={cx("flex items-center gap-1 rounded-full bg-raised py-1 pl-3 pr-1 text-[13px]")}
                >
                  {c}
                  <button
                    type="button"
                    aria-label={`Remove ${c}`}
                    onClick={() => setCollaborators(collaborators.filter((x) => x !== c))}
                    className="flex size-6 items-center justify-center rounded-full text-ink-3 hover:bg-[#333] hover:text-white"
                  >
                    <Xmark className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-3">Collaborators can add and reorder tracks. Only you can change the details.</p>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button slot="close" variant="tertiary">
          Cancel
        </Button>
        <Button onPress={save} isDisabled={saving} isPending={saving}>
          {editing ? "Save changes" : "Create playlist"}
        </Button>
      </Modal.Footer>
    </>
  );
}
