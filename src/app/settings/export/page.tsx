"use client";

import * as React from "react";
import { Button, Input, Label, TextField, toast } from "@heroui/react";
import { Empty, ErrorNote, Loading, Page, Pill } from "@/components/ui";
import { SaveBar, SettingsGate, SettingsPanel, SettingsSection, useSave } from "@/components/settings/settings-kit";
import { authHeader, readErrorMessage, RequestError } from "@/components/settings/api-fetch";
import { fmtDateLong, fmtWhen } from "@/lib/format";
import { useLB } from "@/lib/use-lb";
import { useApi, type AuthUser } from "@/lib/auth";

export default function ExportSettingsPage() {
  return (
    <Page title="Export" subtitle="Download a copy of your listens and feedback.">
      <SettingsGate what="export your data">{(user) => <ExportArea user={user} />}</SettingsGate>
    </Page>
  );
}

type ExportStatusValue = "waiting" | "in_progress" | "completed" | "failed";

type ExportRow = {
  export_id: number;
  type: string;
  created: string;
  available_until: string | null;
  progress: string;
  filename: string | null;
  status: ExportStatusValue;
  start_time: number | null;
  end_time: number | null;
};

const isRunning = (s: ExportStatusValue) => s === "waiting" || s === "in_progress";

const STATUS: Record<ExportStatusValue, { label: string; tone: "neutral" | "positive" | "negative" | "warning" }> = {
  waiting: { label: "Queued", tone: "warning" },
  in_progress: { label: "Preparing", tone: "warning" },
  completed: { label: "Ready", tone: "positive" },
  failed: { label: "Failed", tone: "negative" },
};

const TYPE_LABEL: Record<string, string> = {
  export_all_user_data: "Listens and feedback",
};

const TODAY = new Date().toISOString().slice(0, 10);

/** Midnight UTC of a YYYY-MM-DD date, in UNIX seconds. */
const startOfDayUnix = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 1000);
/** The last second of a YYYY-MM-DD date (UTC), in UNIX seconds. */
const endOfDayUnix = (day: string) => Math.floor(Date.parse(`${day}T23:59:59Z`) / 1000);

function ExportArea({ user }: { user: AuthUser }) {
  const exports = useExports(user);
  const running = exports.data?.some((e) => isRunning(e.status)) ?? false;

  return (
    <div>
      <SettingsSection
        title="Start an export"
        description="Every listen, love and hate in one archive. One export at a time."
        summary={running ? "An export is running. Wait for it before starting another." : undefined}
      >
        <StartExport user={user} disabled={running} onStarted={() => exports.mutate()} />
      </SettingsSection>

      <SettingsSection
        title="Your exports"
        description="Download before the date shown."
      >
        <ExportList user={user} exports={exports} />
      </SettingsSection>
    </div>
  );
}

function useExports(user: AuthUser) {
  const api = useApi();
  return useLB(
    ["exports-list"],
    async () => {
      const res = await fetch(`${api.APIBaseURI}/export/list`, { headers: authHeader(user.token) });
      if (!res.ok) throw new RequestError(await readErrorMessage(res), res.status);
      return (await res.json()) as ExportRow[];
    },
    {
      refreshInterval: (latest: ExportRow[] | undefined) => (latest?.some((e) => isRunning(e.status)) ? 10000 : 0),
    }
  );
}

function StartExport({ user, disabled, onStarted }: { user: AuthUser; disabled: boolean; onStarted: () => void }) {
  const api = useApi();
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const badRange = Boolean(from && to && from > to);

  const { save, pending, error } = useSave(async () => {
    const body: { start_time?: number; end_time?: number } = {};
    if (from) body.start_time = startOfDayUnix(from);
    if (to) body.end_time = endOfDayUnix(to);
    const ranged = Boolean(from || to);
    const res = await fetch(`${api.APIBaseURI}/export/`, {
      method: "POST",
      headers: {
        ...authHeader(user.token),
        ...(ranged ? { "Content-Type": "application/json;charset=UTF-8" } : {}),
      },
      body: ranged ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    toast.success("Export started", { description: "It usually takes a few minutes. You can leave this page." });
    onStarted();
  });

  const reason = disabled
    ? "An export is already running."
    : badRange
      ? "The start date is after the end date."
      : undefined;

  return (
    <SettingsPanel>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField value={from} onChange={setFrom} isDisabled={disabled} className="flex flex-col gap-1.5">
          <Label>From (optional)</Label>
          <Input type="date" max={TODAY} className="h-10" />
        </TextField>
        <TextField value={to} onChange={setTo} isDisabled={disabled} className="flex flex-col gap-1.5">
          <Label>To (optional)</Label>
          <Input type="date" max={TODAY} className="h-10" />
        </TextField>
      </div>
      <SaveBar
        dirty
        label="Start export"
        pending={pending}
        saved={false}
        error={error}
        onSave={save}
        disabledReason={reason}
      />
    </SettingsPanel>
  );
}

function ExportList({ user, exports }: { user: AuthUser; exports: ReturnType<typeof useExports> }) {
  const api = useApi();
  const [busy, setBusy] = React.useState<number | null>(null);
  const [confirming, setConfirming] = React.useState<number | null>(null);
  const [actionError, setActionError] = React.useState<string>();

  const download = async (ex: ExportRow) => {
    setBusy(ex.export_id);
    setActionError(undefined);
    try {
      const res = await fetch(`${api.APIBaseURI}/export/${ex.export_id}/download`, {
        headers: authHeader(user.token),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = ex.filename ?? `listenbrainz-export-${ex.export_id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "The download failed.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (ex: ExportRow) => {
    setBusy(ex.export_id);
    setActionError(undefined);
    try {
      const res = await fetch(`${api.APIBaseURI}/export/${ex.export_id}/delete`, {
        method: "POST",
        headers: authHeader(user.token),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      setConfirming(null);
      toast.success("Export deleted");
      await exports.mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "The export could not be deleted.");
    } finally {
      setBusy(null);
    }
  };

  if (exports.isLoading) return <Loading label="Loading your exports" />;
  if (exports.error) return <ErrorNote error={exports.error} onRetry={() => exports.mutate()} />;
  const rows = exports.data ?? [];
  if (!rows.length) return <Empty>No exports yet. Start one above.</Empty>;

  return (
    <div className="flex flex-col gap-3">
      {actionError ? (
        <p role="alert" className="text-[14px] text-negative">
          {actionError}
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {rows.map((ex) => {
          const st = STATUS[ex.status] ?? { label: ex.status, tone: "neutral" as const };
          const isBusy = busy === ex.export_id;
          return (
            <li key={ex.export_id} className="rounded-[12px] bg-raised p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-medium">{TYPE_LABEL[ex.type] ?? "Export"}</span>
                <Pill tone={st.tone}>{st.label}</Pill>
              </div>
              <p className="mt-2 text-[13px] text-ink-2">
                Requested {fmtWhen(ex.created)}
                {ex.progress ? <> · {ex.progress}</> : null}
              </p>
              <p className="mt-1 text-[12px] text-ink-3">
                {ex.start_time != null || ex.end_time != null
                  ? `Covers ${ex.start_time != null ? fmtDateLong(ex.start_time) : "the beginning"} to ${
                      ex.end_time != null ? fmtDateLong(ex.end_time) : "now"
                    }`
                  : "Covers all of your listens"}
                {ex.status === "completed" && ex.available_until ? ` · Available until ${fmtDateLong(ex.available_until)}` : ""}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {ex.status === "completed" ? (
                  <Button size="sm" variant="secondary" isPending={isBusy} isDisabled={isBusy} onPress={() => download(ex)}>
                    Download
                  </Button>
                ) : null}
                {ex.status !== "completed" && isRunning(ex.status) ? (
                  <span className="text-[12px] text-ink-3">Preparing. This list refreshes by itself.</span>
                ) : null}
                {confirming === ex.export_id ? (
                  <>
                    <span className="text-[13px] text-ink-2">Delete this archive? This cannot be undone.</span>
                    <Button size="sm" variant="danger" isDisabled={isBusy} onPress={() => remove(ex)}>
                      Delete export
                    </Button>
                    <Button size="sm" variant="tertiary" onPress={() => setConfirming(null)}>
                      Keep it
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="danger-soft" isDisabled={isBusy} onPress={() => setConfirming(ex.export_id)}>
                    Delete
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
