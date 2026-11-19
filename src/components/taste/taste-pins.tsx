"use client";

import * as React from "react";
import { Button, TextArea, toast } from "@heroui/react";
import { useAuth } from "@/lib/auth";
import { useLB } from "@/lib/use-lb";
import { useListFeedback } from "@/lib/feedback";
import { fmtDateLong, fmtInt } from "@/lib/format";
import { ListenCard } from "@/components/listen/listen-card";
import { Empty, ErrorNote, Panel, Pill, SkeletonRows } from "@/components/ui";
import { pinnedListen } from "@/components/feed/listen-shapes";

const PER_PAGE = 25;

type PinsPage = {
  pinned_recordings?: PinnedRecording[];
  total_count?: number | string;
};

/** A user's pin history, newest first. Own pins can be unpinned, re-blurbed or deleted. */
export function TastePins({ name }: { name: string }) {
  const { api, user } = useAuth();
  const isOwn = !!user && user.name === name;
  const [page, setPage] = React.useState(0);
  const [editing, setEditing] = React.useState<{ rowId: number; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  // Snapshot once per mount: which pin is "currently pinned" is judged against this moment.
  const [nowSec] = React.useState(() => Math.floor(Date.now() / 1000));

  const data = useLB(["taste-pins", name, page], (a) =>
    a.getPinsForUser(name, page * PER_PAGE, PER_PAGE) as Promise<PinsPage>
  );

  const rows = data.data?.pinned_recordings ?? [];
  const total = Number(data.data?.total_count ?? 0);
  const from = total === 0 ? 0 : page * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE + PER_PAGE, total);
  const listens = rows.map(pinnedListen);
  const fb = useListFeedback(listens);
  const loading = !data.data && !data.error;

  const runAction = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      await data.mutate();
      return true;
    } catch (err) {
      toast.danger("Something went wrong", { description: (err as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const unpin = () => user && runAction(() => api.unpinRecording(user.token), "Unpinned");
  const remove = (pin: PinnedRecording) =>
    user && runAction(() => api.deletePin(user.token, pin.row_id), "Pin deleted");

  const saveBlurb = async () => {
    if (!user || !editing) return;
    const ok = await runAction(
      () => api.updatePinRecordingBlurbContent(user.token, editing.rowId, editing.text.trim()),
      "Blurb saved"
    );
    if (ok) setEditing(null);
  };

  return (
    <Panel title="Pins">
      {data.error ? <ErrorNote error={data.error} onRetry={() => void data.mutate()} /> : null}
      {loading ? <SkeletonRows rows={5} /> : null}
      {!loading && !data.error && rows.length === 0 ? (
        <Empty>{isOwn ? "You have not pinned a track yet. Pin one from your listens." : "No pins yet."}</Empty>
      ) : null}

      {rows.length > 0 ? (
        <ul className="flex flex-col" style={{ opacity: data.isValidating ? 0.5 : 1 }}>
          {rows.map((pin, i) => {
            const listen = listens[i];
            const active = pin.pinned_until > nowSec;
            const isEditing = editing?.rowId === pin.row_id;
            const actions = isOwn
              ? [
                  ...(active ? [{ id: "unpin", label: "Unpin", onAction: () => void unpin() }] : []),
                  {
                    id: "edit-blurb",
                    label: "Edit blurb",
                    onAction: () => setEditing({ rowId: pin.row_id, text: pin.blurb_content ?? "" }),
                  },
                  { id: "delete-pin", label: "Delete pin", danger: true, onAction: () => void remove(pin) },
                ]
              : [];
            return (
              <li key={pin.row_id}>
                <ListenCard
                  listen={listen}
                  feedback={fb.get(listen)}
                  extraActions={actions}
                  meta={fmtDateLong(pin.created)}
                  aside={active ? <Pill tone="positive">Currently pinned</Pill> : null}
                />
                {isEditing ? (
                  <div className="mb-3 ml-[60px] flex flex-col gap-2">
                    <TextArea
                      aria-label="Pin blurb"
                      fullWidth
                      value={editing?.text ?? ""}
                      onChange={(e) => setEditing((prev) => (prev ? { ...prev, text: e.target.value } : prev))}
                      placeholder="Why this track?"
                      className="min-h-20"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" isDisabled={busy} onPress={() => void saveBlurb()}>
                        Save blurb
                      </Button>
                      <Button size="sm" variant="tertiary" isDisabled={busy} onPress={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : pin.blurb_content ? (
                  <p className="mb-3 ml-[60px] text-[13px] leading-5 text-ink-2">&ldquo;{pin.blurb_content}&rdquo;</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {total > 0 ? (
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="secondary" size="sm" isDisabled={page === 0} onPress={() => setPage((p) => Math.max(0, p - 1))}>
            Previous
          </Button>
          <span className="num text-[13px] text-ink-3">
            {fmtInt(from)}–{fmtInt(to)} of {fmtInt(total)}
          </span>
          <Button variant="secondary" size="sm" isDisabled={to >= total} onPress={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}
