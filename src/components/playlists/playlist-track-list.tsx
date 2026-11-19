"use client";

import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Grip } from "@gravity-ui/icons";
import { ListenCard } from "@/components/listen/listen-card";
import { useListFeedback } from "@/lib/feedback";
import { fmtWhen } from "@/lib/format";
import { cx } from "@/components/ui";
import { trackAddedBy, trackToListen, trackRecordingMBID } from "./playlist-utils";

/**
 * The tracks of a playlist, one ListenCard per track. When `canEdit` is set each row gets a grip
 * (drag to reorder, with pointer, touch or keyboard) and the "…" menu gets Move up / Move down /
 * Remove, so reordering also works without dragging.
 */
export function PlaylistTrackList({
  tracks,
  canEdit,
  onMove,
  onRemove,
}: {
  tracks: JSPFTrack[];
  canEdit: boolean;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}) {
  const listens = React.useMemo(() => tracks.map(trackToListen), [tracks]);
  const fb = useListFeedback(listens);

  // Index-suffixed so ids stay unique when the same recording appears twice.
  const ids = React.useMemo(
    () => tracks.map((track, i) => `${trackRecordingMBID(track)}-${i}`),
    [tracks]
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onMove(from, to);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col" aria-label="Tracks">
          {tracks.map((track, i) => {
            const listen = listens[i];
            const { by, at } = trackAddedBy(track);
            const title = track.title;
            const extraActions = canEdit
              ? [
                  ...(i > 0 ? [{ id: "move-up", label: "Move up", onAction: () => onMove(i, i - 1) }] : []),
                  ...(i < tracks.length - 1 ? [{ id: "move-down", label: "Move down", onAction: () => onMove(i, i + 1) }] : []),
                  { id: "remove-track", label: "Remove from playlist", danger: true, onAction: () => onRemove(i) },
                ]
              : [];
            const meta = by ? (
              <>
                added by {by}
                {at ? (
                  <>
                    <br />
                    {fmtWhen(at)}
                  </>
                ) : null}
              </>
            ) : undefined;
            return (
              <SortableTrackRow key={ids[i]} id={ids[i]} title={title} canEdit={canEdit}>
                <ListenCard
                  listen={listen}
                  context={listens}
                  feedback={fb.get(listen)}
                  meta={meta}
                  canDelete={false}
                  extraActions={extraActions}
                />
              </SortableTrackRow>
            );
          })}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

/** One sortable row. Only the grip is the drag handle. */
function SortableTrackRow({
  id,
  title,
  canEdit,
  children,
}: {
  id: string;
  title: string;
  canEdit: boolean;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id, disabled: !canEdit });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx(
        "flex items-center gap-1 rounded-[12px]",
        isDragging && "relative z-10 opacity-70",
        isOver && !isDragging && "shadow-[inset_0_2px_0_0_var(--data)]"
      )}
    >
      {canEdit ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag ${title} to reorder`}
          title="Drag to reorder"
          className="flex h-12 w-6 flex-none cursor-grab touch-none items-center justify-center rounded text-ink-3 hover:text-white active:cursor-grabbing"
        >
          <Grip className="size-4" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
