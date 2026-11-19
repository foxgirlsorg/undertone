"use client";

import * as React from "react";
import { Button, Checkbox, Description, Input, Label, Modal, TextArea, TextField, toast } from "@heroui/react";
import { useAuth } from "@/lib/auth";
import { useLB } from "@/lib/use-lb";
import { getRecordingMBID, getRecordingMSID } from "@/lib/listen";
import { Empty, ErrorNote, Loading } from "@/components/ui";
import { ModalShell, TrackRow, errorText, trackLabel, type ListenModalProps } from "./shared";

const MAX_BLURB = 280;

export function RecommendPersonalModal({ open, listen, onClose, onDone }: ListenModalProps) {
  return (
    <ModalShell open={open} onClose={onClose} title="Personally recommend" wide>
      <RecommendPersonalForm listen={listen} onClose={onClose} onDone={onDone} />
    </ModalShell>
  );
}

function RecommendPersonalForm({ listen, onClose, onDone }: Omit<ListenModalProps, "open">) {
  const { api, user } = useAuth();
  const followers = useLB(user ? ["user-followers"] : null, (a, u) => a.getFollowersOfUser(u?.name ?? ""));
  const [filter, setFilter] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [blurb, setBlurb] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const mbid = getRecordingMBID(listen);
  const msid = getRecordingMSID(listen);
  const hasId = !!(mbid || msid);
  const names = followers.data?.followers ?? [];
  const needle = filter.trim().toLowerCase();
  const shown = needle ? names.filter((n) => n.toLowerCase().includes(needle)) : names;
  const canSend = !!user && hasId && selected.length > 0 && blurb.trim().length > 0 && !busy;

  const toggle = (name: string, on: boolean) =>
    setSelected((prev) => (on ? [...prev.filter((n) => n !== name), name] : prev.filter((n) => n !== name)));

  const send = async () => {
    if (!user || !canSend) return;
    setBusy(true);
    try {
      await api.submitPersonalRecommendation(user.token, user.name, {
        recording_mbid: mbid,
        recording_msid: msid,
        users: selected,
        blurb_content: blurb.trim(),
      });
      toast.success(`Recommended to ${selected.length} ${selected.length === 1 ? "user" : "users"}`, {
        description: trackLabel(listen),
      });
      onDone();
    } catch (err) {
      toast.danger("Couldn't send the recommendation", { description: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal.Body className="flex flex-col gap-4">
        <TrackRow listen={listen} />
        {!hasId ? (
          <p className="text-[14px] text-negative">This listen has no recording id, so it can’t be recommended.</p>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[14px] font-medium">Recommend to</span>
            <span className="num text-[12px] text-ink-3">{selected.length} selected</span>
          </div>
          {followers.isLoading ? (
            <Loading label="Loading followers" />
          ) : followers.error ? (
            <ErrorNote error={followers.error} onRetry={() => followers.mutate()} />
          ) : names.length === 0 ? (
            <Empty>You have no followers yet. Only people who follow you can receive a personal recommendation.</Empty>
          ) : (
            <>
              <TextField value={filter} onChange={setFilter} className="flex flex-col gap-1.5">
                <Label className="sr-only">Filter followers</Label>
                <Input placeholder="Filter followers" className="h-10" />
              </TextField>
              <div className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto">
                {shown.length === 0 ? (
                  <p className="px-2 py-2 text-[14px] text-ink-3">No followers match “{filter.trim()}”.</p>
                ) : (
                  shown.map((name) => (
                    <Checkbox
                      key={name}
                      isSelected={selected.includes(name)}
                      onChange={(on: boolean) => toggle(name, on)}
                      className="min-h-[44px] rounded-[12px] px-2 hover:bg-[#161616]"
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <span className="text-[14px]">{name}</span>
                      </Checkbox.Content>
                    </Checkbox>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <TextField value={blurb} onChange={setBlurb} isRequired className="flex flex-col gap-2">
          <Label>Why are you recommending it?</Label>
          <TextArea rows={3} maxLength={MAX_BLURB} placeholder="Say why they should listen." className="w-full" />
          <Description>Required. Sent with the recommendation.</Description>
        </TextField>
        <p className="num text-right text-[12px] text-ink-3">
          {blurb.length} / {MAX_BLURB}
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="tertiary" onPress={onClose}>
          Cancel
        </Button>
        <Button onPress={send} isDisabled={!canSend}>
          {busy ? "Sending…" : "Send recommendation"}
        </Button>
      </Modal.Footer>
    </>
  );
}
