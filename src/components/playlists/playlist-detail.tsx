"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertDialog, Button, toast } from "@heroui/react";
import { ArrowDownToLine, ArrowUpRightFromSquare, Pencil, TrashBin } from "@gravity-ui/icons";
import { useAuth } from "@/lib/auth";
import { useLB, errorMessage } from "@/lib/use-lb";
import { fmtDateLong, fmtDuration, plural } from "@/lib/format";
import { getCoverArt } from "@/lib/listen";
import { usePlayer } from "@/components/player/player-context";
import { CoverArt, Empty, ErrorNote, Link, Page, Panel, Pill, SkeletonRows, UserLink } from "@/components/ui";
import { CreateOrEditPlaylistModal } from "./create-or-edit-playlist-modal";
import { AddTrackField } from "./add-track-field";
import { PlaylistTrackList } from "./playlist-track-list";
import {
  canEditTracks,
  collaboratorsOf,
  getPlaylistExt,
  getPlaylistJSON,
  isOwner,
  isPlaylistPublic,
  lbPlaylistUrl,
  PLAYLIST_URI_PREFIX,
  playlistId,
  renderDescription,
  saveBlob,
  totalDurationMs,
  trackRecordingMBID,
  trackToListen,
} from "./playlist-utils";

const NO_TRACKS: JSPFTrack[] = [];

/** One playlist: header with cover collage and actions, then its tracks (editable for owner and collaborators). */
export function PlaylistDetail({ playlistMBID }: { playlistMBID: string }) {
  const { api, user } = useAuth();
  const player = usePlayer();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useLB(["playlist", playlistMBID], (a, u) =>
    getPlaylistJSON(a, playlistMBID, u?.token)
  );
  const pl = data?.playlist;
  // Track order as the server has it, plus any optimistic edit made on top of that same snapshot.
  const serverTracks = pl?.track ?? NO_TRACKS;
  const [edited, setEdited] = React.useState<{ base: JSPFTrack[]; tracks: JSPFTrack[] } | null>(null);
  const tracks = edited && edited.base === serverTracks ? edited.tracks : serverTracks;
  const setTracks = (next: JSPFTrack[]) => setEdited({ base: serverTracks, tracks: next });
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const ext = getPlaylistExt(pl);
  const owner = isOwner(pl, user?.name);
  const editable = !!pl && canEditTracks(pl, user?.name);
  const listens = React.useMemo(() => tracks.map(trackToListen), [tracks]);

  const requireSignIn = () => {
    toast.danger("Sign in to change this playlist");
    return false;
  };

  const move = async (from: number, to: number) => {
    if (!user || !editable) return requireSignIn();
    const prev = tracks;
    const next = [...tracks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setTracks(next);
    try {
      await api.movePlaylistItem(user.token, playlistMBID, trackRecordingMBID(moved), from, to, 1);
    } catch (e) {
      setTracks(prev);
      toast.danger("Couldn't move track", { description: errorMessage(e) });
    }
  };

  const remove = async (index: number) => {
    if (!user || !editable) return requireSignIn();
    const track = tracks[index];
    try {
      await api.deletePlaylistItems(user.token, playlistMBID, trackRecordingMBID(track), index, 1);
      setTracks(tracks.filter((_, i) => i !== index));
      toast("Removed from playlist", { description: track.title });
    } catch (e) {
      toast.danger("Couldn't remove track", { description: errorMessage(e) });
    }
  };

  const saveCopy = async () => {
    if (!user) return requireSignIn();
    setBusy(true);
    try {
      const newId = await api.copyPlaylist(user.token, playlistMBID);
      toast.success("Saved a copy to your playlists");
      router.push(`/playlist/${newId}`);
    } catch (e) {
      toast.danger("Couldn't save a copy", { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const deletePlaylist = async () => {
    if (!user || !owner) return requireSignIn();
    setBusy(true);
    try {
      await api.deletePlaylist(user.token, playlistMBID);
      toast("Playlist deleted");
      router.push(`/user/${encodeURIComponent(user.name)}/playlists`);
    } catch (e) {
      toast.danger("Couldn't delete playlist", { description: errorMessage(e) });
      setBusy(false);
    }
  };

  const download = async (kind: "xspf" | "jspf") => {
    if (!pl) return;
    try {
      const headers: Record<string, string> = {};
      if (user) headers.Authorization = `Token ${user.token}`;
      const res =
        kind === "xspf"
          ? await fetch(`${api.APIBaseURI}/playlist/${playlistMBID}/xspf`, { headers })
          : await api.getPlaylist(playlistMBID, user?.token);
      if (!res.ok) throw new Error(`ListenBrainz answered ${res.status}.`);
      saveBlob(await res.blob(), `${pl.title}.${kind}`);
    } catch (e) {
      toast.danger(`Couldn't export ${kind.toUpperCase()}`, { description: errorMessage(e) });
    }
  };

  if (error) {
    return (
      <Page title="Playlist">
        <ErrorNote error={error} onRetry={() => mutate()} />
      </Page>
    );
  }
  if (isLoading || !pl) {
    return (
      <Page title="Playlist">
        <SkeletonRows rows={4} cover={false} />
      </Page>
    );
  }

  const id = playlistId(pl);
  const collaborators = collaboratorsOf(pl);
  const copiedFrom = ext?.copied_from?.startsWith(PLAYLIST_URI_PREFIX)
    ? ext.copied_from.slice(PLAYLIST_URI_PREFIX.length)
    : undefined;
  const count = tracks.length;

  return (
    <Page title={pl.title || "Untitled playlist"}>
      <section className="flex flex-col gap-5 rounded-[20px] bg-card p-[22px] sm:flex-row">
        <Collage tracks={tracks} title={pl.title} />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
            <Pill tone={isPlaylistPublic(pl) ? "positive" : "neutral"}>{isPlaylistPublic(pl) ? "Public" : "Private"}</Pill>
            <span className="text-ink-2">
              Playlist by <UserLink name={pl.creator} avatar />
            </span>
          </div>

          {collaborators.length ? (
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              <span>With the help of</span>
              {collaborators.map((c) => (
                <UserLink key={c} name={c} avatar />
              ))}
            </div>
          ) : null}

          <div className="num text-[13px] text-ink-3">
            {plural(count, "track")}
            {count ? ` · ${fmtDuration(totalDurationMs(tracks))}` : ""} · Created {fmtDateLong(pl.date)}
            {ext?.last_modified_at ? ` · Modified ${fmtDateLong(ext.last_modified_at)}` : ""}
          </div>
          {copiedFrom ? (
            <div className="text-[13px] text-ink-3">
              Copied from{" "}
              <Link href={`/playlist/${copiedFrom}`} muted>
                {copiedFrom}
              </Link>
            </div>
          ) : null}

          {pl.annotation?.trim() ? (
            <div className="max-w-[70ch] text-[14px] leading-6 text-ink-2">{renderDescription(pl.annotation)}</div>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
            <Button onPress={() => player.playQueue(listens, 0)} isDisabled={!count}>
              Play all
            </Button>
            {user ? (
              <Button variant="secondary" onPress={saveCopy} isDisabled={busy}>
                Save a copy
              </Button>
            ) : null}
            {owner ? (
              <Button variant="secondary" onPress={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                Edit
              </Button>
            ) : null}
            <Button variant="tertiary" onPress={() => download("xspf")}>
              <ArrowDownToLine className="size-4" />
              Export XSPF
            </Button>
            <Button variant="tertiary" onPress={() => download("jspf")}>
              <ArrowDownToLine className="size-4" />
              Download JSPF
            </Button>
            <Button variant="tertiary" onPress={() => window.open(lbPlaylistUrl(id), "_blank", "noopener")}>
              <ArrowUpRightFromSquare className="size-4" />
              Open in ListenBrainz
            </Button>
            {owner ? (
              <Button variant="danger-soft" onPress={() => setConfirmDelete(true)}>
                <TrashBin className="size-4" />
                Delete
              </Button>
            ) : null}
          </div>
          <p className="text-[12px] text-ink-3">
            Spotify, Apple Music and SoundCloud exports need the accounts connected on{" "}
            <a href={lbPlaylistUrl(id)} target="_blank" rel="noopener noreferrer" className="text-ink-2 underline-offset-2 hover:text-white hover:underline">
              listenbrainz.org
            </a>
            , so they are done there.
          </p>
        </div>
      </section>

      <Panel
        title="Tracks"
        aside={count ? <span className="num">{plural(count, "track")}</span> : null}
      >
        <div className="flex flex-col gap-4">
          {editable ? <AddTrackField playlistMBID={playlistMBID} onAdded={() => mutate()} /> : null}
          {count ? (
            <PlaylistTrackList tracks={tracks} canEdit={editable} onMove={move} onRemove={remove} />
          ) : (
            <Empty>Nothing in this playlist yet.</Empty>
          )}
          {editable && count > 1 ? (
            <p className="text-[12px] text-ink-3">Drag the grip to reorder, or use “Move up” and “Move down” in a track&apos;s menu.</p>
          ) : null}
        </div>
      </Panel>

      {owner ? (
        <>
          <CreateOrEditPlaylistModal
            isOpen={editOpen}
            onOpenChange={setEditOpen}
            playlist={pl}
            onSaved={() => mutate()}
          />
          <AlertDialog.Backdrop isOpen={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialog.Container>
              <AlertDialog.Dialog className="sm:max-w-[400px]">
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="danger" />
                  <AlertDialog.Heading>Delete this playlist?</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>
                    <strong>{pl.title}</strong> and its {plural(count, "track")} will be deleted. This cannot be undone.
                  </p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button slot="close" variant="tertiary">
                    Cancel
                  </Button>
                  <Button variant="danger" onPress={deletePlaylist} isDisabled={busy} isPending={busy}>
                    Delete playlist
                  </Button>
                </AlertDialog.Footer>
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          </AlertDialog.Backdrop>
        </>
      ) : null}
    </Page>
  );
}

/** 2x2 collage of the first four tracks' covers. */
function Collage({ tracks, title }: { tracks: JSPFTrack[]; title: string }) {
  const covers = tracks.slice(0, 4).map((t) => {
    const l = trackToListen(t);
    return { src: getCoverArt(l), alt: l.track_metadata.release_name || l.track_metadata.track_name || title };
  });
  if (!covers.length) {
    return <CoverArt alt={title} size={160} rounded={12} />;
  }
  return (
    <div className="grid size-[160px] flex-none grid-cols-2 gap-[2px] overflow-hidden rounded-[12px] bg-[#111]" aria-hidden>
      {[0, 1, 2, 3].map((i) =>
        covers[i] ? (
          <CoverArt key={i} src={covers[i].src} alt={covers[i].alt} size={79} rounded={0} className="size-[79px]" />
        ) : (
          <div key={i} className="size-[79px] bg-raised" />
        )
      )}
    </div>
  );
}
