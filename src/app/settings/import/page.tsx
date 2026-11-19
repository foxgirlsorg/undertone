"use client";

import * as React from "react";
import { Button, Input, Label, ListBox, Select, TextField, toast } from "@heroui/react";
import { Empty, ErrorNote, Link, Loading, Page, Pill, cx } from "@/components/ui";
import { SettingsGate, SettingsPanel, SettingsSection } from "@/components/settings/settings-kit";
import { authHeader, readErrorMessage, RequestError } from "@/components/settings/api-fetch";
import { listTimezones } from "@/components/settings/format";
import { fmtDateLong, fmtWhen } from "@/lib/format";
import { useLB } from "@/lib/use-lb";
import { useApi, type AuthUser } from "@/lib/auth";

export default function ImportListensSettingsPage() {
  return (
    <Page
      title="Import listens"
      subtitle="Bring your listening history in from a file. Connected services are set up under Music services."
    >
      <SettingsGate what="import your listens">{(user) => <ImportArea user={user} />}</SettingsGate>
    </Page>
  );
}

type ImportStatusValue = "waiting" | "in_progress" | "completed" | "failed" | "cancelled";

type ImportRow = {
  import_id: number;
  service: string;
  created: string;
  from_date: string;
  to_date: string;
  metadata: {
    filename?: string;
    progress?: string;
    status: ImportStatusValue;
    attempted_count?: number;
    success_count?: number;
    detailed_message?: string;
  };
};

const isRunning = (status: ImportStatusValue) => status === "waiting" || status === "in_progress";

const STATUS_LABEL: Record<ImportStatusValue, string> = {
  waiting: "Queued",
  in_progress: "Importing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<ImportStatusValue, "neutral" | "positive" | "negative" | "warning"> = {
  waiting: "warning",
  in_progress: "warning",
  completed: "positive",
  failed: "negative",
  cancelled: "neutral",
};

const IMPORT_SERVICES: Array<{ key: string; label: string; accept: string; help: string }> = [
  {
    key: "spotify",
    label: "Spotify",
    accept: ".zip",
    help: "Your extended streaming history, uploaded as the complete .zip without extracting it.",
  },
  {
    key: "listenbrainz",
    label: "ListenBrainz",
    accept: ".zip",
    help: "A ListenBrainz export archive (.zip), as downloaded from Export.",
  },
  { key: "librefm", label: "Libre.fm", accept: ".csv", help: "A Libre.fm history export (.csv)." },
  { key: "panoscrobbler", label: "PanoScrobbler", accept: ".jsonl", help: "A PanoScrobbler export (.jsonl)." },
  { key: "maloja", label: "Maloja", accept: ".json", help: "A Maloja scrobble export (.json)." },
  {
    key: "audioscrobbler",
    label: "Audioscrobbler / Rockbox",
    accept: ".log",
    help: "A scrobble log (.log). Its times have no zone, so pick one below if you know it.",
  },
  { key: "spinitron", label: "Spinitron", accept: ".csv", help: "A Spinitron play history export (.csv)." },
];

const TIMEZONE_CHOICES = listTimezones();
const TODAY = new Date().toISOString().slice(0, 10);

function ImportArea({ user }: { user: AuthUser }) {
  const imports = useImports(user);

  return (
    <div>
      <SettingsSection
        title="Latest import"
        description="The newest listen Undertone has imported for each service. Imports stop when they reach this point, so they do not duplicate listens."
      >
        <SettingsPanel className="flex flex-col gap-3">
          <LatestImport user={user} service="lastfm" label="Last.fm" />
          <LatestImport user={user} service="librefm" label="Libre.fm" />
        </SettingsPanel>
      </SettingsSection>

      <SettingsSection
        title="Upload a history file"
        description={
          <>
            One import per service at a time. Duplicates are skipped by time, so you can import overlapping ranges. Files
            are deleted once the import finishes. For live connections use{" "}
            <Link href="/settings/music-services" className="text-ink-2 underline underline-offset-2">
              Music services
            </Link>
            .
          </>
        }
      >
        <UploadForm user={user} imports={imports.data} onQueued={() => imports.mutate()} />
      </SettingsSection>

      <SettingsSection
        title="Your imports"
        description="Running imports refresh every 10 seconds. You can close this page while they run."
      >
        <ImportList user={user} imports={imports} />
      </SettingsSection>
    </div>
  );
}

function useImports(user: AuthUser) {
  const api = useApi();
  return useLB(
    ["import-listens-list"],
    async () => {
      const res = await fetch(`${api.APIBaseURI}/import-listens/list/`, { headers: authHeader(user.token) });
      if (!res.ok) throw new RequestError(await readErrorMessage(res), res.status);
      return (await res.json()) as ImportRow[];
    },
    {
      refreshInterval: (latest: ImportRow[] | undefined) => (latest?.some((i) => isRunning(i.metadata.status)) ? 10000 : 0),
    }
  );
}

function LatestImport({ user, service, label }: { user: AuthUser; service: "lastfm" | "librefm"; label: string }) {
  const { data, error, isLoading, mutate } = useLB(["latest-import", service], (api) =>
    api.getLatestImport(user.name, service)
  );
  const ts = data?.latest_import;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
      <span className="text-ink-2">{label}</span>
      {isLoading ? (
        <Loading label="Loading" />
      ) : error ? (
        <ErrorNote error={error} onRetry={() => mutate()} />
      ) : (
        <span className="num text-white">{ts ? fmtWhen(ts) : "Never imported"}</span>
      )}
    </div>
  );
}

function UploadForm({
  user,
  imports,
  onQueued,
}: {
  user: AuthUser;
  imports: ImportRow[] | undefined;
  onQueued: () => void;
}) {
  const api = useApi();
  const [service, setService] = React.useState("spotify");
  const [file, setFile] = React.useState<File | null>(null);
  const [fileKey, setFileKey] = React.useState(0);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [zone, setZone] = React.useState("profile");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();

  const svc = IMPORT_SERVICES.find((s) => s.key === service) ?? IMPORT_SERVICES[0];
  const runningHere = imports?.some((i) => i.service === service && isRunning(i.metadata.status)) ?? false;
  const badRange = Boolean(from && to && from > to);

  const disabledReason = runningHere
    ? `A ${svc.label} import is already running. Wait for it to finish, or cancel it while it is queued.`
    : !file
      ? "Choose a file to import."
      : badRange
        ? "The start date is after the end date."
        : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabledReason || !file) return;
    setPending(true);
    setError(undefined);
    try {
      const body = new FormData();
      body.append("service", service);
      body.append("file", file, file.name);
      if (from) body.append("from_date", from);
      if (to) body.append("to_date", to);
      if (service === "audioscrobbler" && zone !== "profile") body.append("timezone", zone);
      const res = await fetch(`${api.APIBaseURI}/import-listens/`, {
        method: "POST",
        headers: authHeader(user.token),
        body,
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      await res.json();
      toast.success(`${svc.label} import queued`);
      setFile(null);
      setFileKey((k) => k + 1);
      onQueued();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The import could not be started.");
    } finally {
      setPending(false);
    }
  };

  return (
    <SettingsPanel>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Select
          aria-label="Service"
          selectedKey={service}
          onSelectionChange={(key) => {
            if (key == null) return;
            setService(String(key));
            setFile(null);
            setFileKey((k) => k + 1);
          }}
          className="w-full"
        >
          <Label>Service</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {IMPORT_SERVICES.map((s) => (
                <ListBox.Item key={s.key} id={s.key} textValue={s.label}>
                  {s.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="import-file" className="text-[14px] font-medium">
            File
          </label>
          <input
            key={fileKey}
            id="import-file"
            type="file"
            accept={svc.accept}
            onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
            className="text-[14px] text-ink-2 file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-raised file:px-3 file:py-2 file:text-[13px] file:text-white"
          />
          <p className="text-[13px] text-ink-3">
            {svc.help} Accepted: <span className="num">{svc.accept}</span>
          </p>
        </div>

        <details className="group">
          <summary className="cursor-pointer text-[14px] text-ink-2 hover:text-white">Limit the date range</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <TextField value={from} onChange={setFrom} className="flex flex-col gap-1.5">
              <Label>From (optional)</Label>
              <Input type="date" max={TODAY} className="h-10" />
            </TextField>
            <TextField value={to} onChange={setTo} className="flex flex-col gap-1.5">
              <Label>To (optional)</Label>
              <Input type="date" max={TODAY} className="h-10" />
            </TextField>
            {service === "audioscrobbler" ? (
              <div className="sm:col-span-2">
                <Select
                  aria-label="Timezone for this file"
                  selectedKey={zone}
                  onSelectionChange={(key) => key != null && setZone(String(key))}
                  className="w-full"
                >
                  <Label>Timezone for this file</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="profile" textValue="Profile timezone">
                        Use my profile timezone
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      {TIMEZONE_CHOICES.map((z) => (
                        <ListBox.Item key={z} id={z} textValue={z}>
                          {z}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
            ) : null}
          </div>
        </details>

        {error ? (
          <p role="alert" className="text-[14px] text-negative">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className={cx("mr-auto text-[13px]", disabledReason ? "text-ink-3" : "text-ink-2")}>
            {disabledReason ?? "Ready to import."}
          </span>
          <Button type="submit" isDisabled={Boolean(disabledReason) || pending} isPending={pending}>
            Import listens
          </Button>
        </div>
      </form>
    </SettingsPanel>
  );
}

function ImportList({ user, imports }: { user: AuthUser; imports: ReturnType<typeof useImports> }) {
  const api = useApi();
  const [busy, setBusy] = React.useState<number | null>(null);
  const [cancelError, setCancelError] = React.useState<string>();

  const cancel = async (id: number) => {
    setBusy(id);
    setCancelError(undefined);
    try {
      const res = await fetch(`${api.APIBaseURI}/import-listens/cancel/${id}/`, {
        method: "POST",
        headers: authHeader(user.token),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      toast.success("Import cancelled", { description: "You can request a new import at any time." });
      await imports.mutate();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "The import could not be cancelled.");
    } finally {
      setBusy(null);
    }
  };

  if (imports.isLoading) return <Loading label="Loading your imports" />;
  if (imports.error) return <ErrorNote error={imports.error} onRetry={() => imports.mutate()} />;
  const rows = imports.data ?? [];
  if (!rows.length) return <Empty>No imports yet. Your uploads will appear here.</Empty>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" variant="tertiary" onPress={() => imports.mutate()}>
          Refresh
        </Button>
      </div>
      {cancelError ? (
        <p role="alert" className="text-[14px] text-negative">
          {cancelError}
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <ImportCard key={row.import_id} row={row} busy={busy === row.import_id} onCancel={() => cancel(row.import_id)} />
        ))}
      </ul>
    </div>
  );
}

function ImportCard({ row, busy, onCancel }: { row: ImportRow; busy: boolean; onCancel: () => void }) {
  const status = row.metadata.status;
  const label = IMPORT_SERVICES.find((s) => s.key === row.service)?.label ?? row.service;
  const attempted = row.metadata.attempted_count ?? 0;
  const success = row.metadata.success_count ?? 0;
  const from = new Date(row.from_date);
  const to = new Date(row.to_date);
  const fromText = from.getTime() > 0 ? fmtDateLong(from) : "The start of history";
  const toText = Number.isNaN(to.getTime()) ? "Now" : fmtDateLong(to);

  return (
    <li className="rounded-[12px] bg-raised p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] font-medium">{label}</span>
        <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status] ?? status}</Pill>
        <span className="min-w-0 truncate text-[13px] text-ink-3">{row.metadata.filename ?? ""}</span>
      </div>
      <p className="mt-2 text-[13px] text-ink-2">
        Requested {fmtWhen(row.created)}
        {row.metadata.progress ? <> · {row.metadata.progress}</> : null}
      </p>
      {attempted > 0 ? (
        <p className="num mt-1 text-[13px] text-ink-2">
          Imported {success} of {attempted} listens
        </p>
      ) : null}
      {row.metadata.detailed_message ? <p className="mt-1 text-[13px] text-ink-3">{row.metadata.detailed_message}</p> : null}
      <p className="mt-1 text-[12px] text-ink-3">
        Covers {fromText} to {toText}
      </p>
      {status === "completed" ? (
        <p className="mt-2 text-[12px] text-ink-3">Listen counts update right away. Statistics can take up to two weeks to include them.</p>
      ) : null}
      {status === "waiting" ? (
        <div className="mt-3">
          <Button size="sm" variant="secondary" isPending={busy} isDisabled={busy} onPress={onCancel}>
            Cancel import
          </Button>
        </div>
      ) : null}
      {status === "in_progress" ? (
        <p className="mt-2 text-[12px] text-ink-3">Running. It cannot be cancelled once it has started.</p>
      ) : null}
      {status === "failed" ? (
        <p className="mt-2 text-[12px] text-ink-3">The import failed. Check the file and try again. Contact us if it keeps failing.</p>
      ) : null}
    </li>
  );
}
