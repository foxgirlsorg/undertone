"use client";

import * as React from "react";
import { FlairName, HOVER_FLAIRS } from "@/components/ui/flair-name";
import { ListBox, Label, Select } from "@heroui/react";
import { ErrorNote, Link, Loading, Page } from "@/components/ui";
import { SaveBar, PasswordGate, SettingsGate, SettingsPanel, SettingsSection, useSave } from "@/components/settings/settings-kit";
import { useLB } from "@/lib/use-lb";
import { FlairEnum, type Flair } from "@/lib/enums";
import { useApi, useAuth, type AuthUser } from "@/lib/auth";

export default function FlairSettingsPage() {
  return (
    <Page title="Flair" subtitle="A small name effect shown next to your username.">
      <PasswordGate what="your flair">
        <SettingsGate what="choose a flair">{(user) => <FlairForm user={user} />}</SettingsGate>
      </PasswordGate>
    </Page>
  );
}

const FLAIR_LABELS: Record<keyof typeof FlairEnum, string> = {
  None: "No flair",
  Shake: "Shake",
  ColorSweep: "Colour sweep",
  LightSweep: "Light sweep",
  Wave: "Wave",
  FlipHorizontal: "Flip horizontal",
  FlipVertical: "Flip vertical",
  Flip3D: "Flip 3D",
  Extruded: "Extruded",
  Underline: "Underline",
  Tornado: "Tornado",
  Highlighter: "Highlighter",
  Anaglyph: "Anaglyph",
  Sliced: "Sliced",
};

const FLAIR_OPTIONS = (Object.keys(FlairEnum) as Array<keyof typeof FlairEnum>).map((k) => ({
  key: FlairEnum[k] === "" ? "none" : FlairEnum[k],
  value: FlairEnum[k] as Flair,
  label: FLAIR_LABELS[k],
}));

function FlairForm({ user }: { user: AuthUser }) {
  const { data: flairs, error, isLoading, mutate } = useLB(["all-flairs"], (api) => api.getUserFlairs());

  // Flairs are a donor perk: the all-flairs list only includes users whose donation unlocked one.
  const unlocked = flairs ? Object.prototype.hasOwnProperty.call(flairs, user.name) : undefined;
  // A password sign-in reads the saved flair; otherwise only unlocked flairs are public, so the last saved value is kept here.
  const { account } = useAuth();
  const fromSession = typeof account?.flair === "string" ? (account.flair as Flair) : undefined;
  const current: Flair = fromSession ?? (flairs?.[user.name] as Flair | undefined) ?? ("" as Flair);
  const [draft, setDraft] = React.useState<Flair | null>(null);
  const [baseline, setBaseline] = React.useState<Flair | null>(null);
  const saidFlair = baseline ?? current;
  const selected: Flair = draft ?? saidFlair;

  const api = useApi();
  const { save, pending, saved, error: saveError } = useSave(async () => {
    if (draft === null) throw new Error("Choose a flair first.");
    await api.submitFlairPreferences(user.token, draft);
    setBaseline(draft);
  });

  return (
    <div>
      <SettingsSection
        title="Your flair"
        description={
          <>
            A perk for{" "}
            <Link href="/donors" className="text-ink-2 underline underline-offset-2">
              donors
            </Link>
            .
          </>
        }
        summary={
          unlocked === undefined
            ? null
            : unlocked
              ? "Unlocked."
              : "Locked until your next donation."
        }
      >
        <SettingsPanel>
          {isLoading ? <Loading label="Checking your flair" /> : null}
          {error ? <ErrorNote error={error} onRetry={() => mutate()} /> : null}
          {flairs ? (
            <>
              <Select
                aria-label="Flair"
                selectedKey={selected === "" ? "none" : selected}
                onSelectionChange={(key) => {
                  const opt = FLAIR_OPTIONS.find((o) => o.key === String(key));
                  if (opt) setDraft(opt.value);
                }}
                className="w-full"
              >
                <Label>Flair</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {FLAIR_OPTIONS.map((o) => (
                      <ListBox.Item key={o.key} id={o.key} textValue={o.label}>
                        {o.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              <div className="mt-4 flex min-h-[72px] items-center justify-center rounded-[12px] bg-raised px-4 py-6">
                <span
                  className="text-[20px] font-medium"
                  aria-label={`Preview of ${user.name} with ${FLAIR_OPTIONS.find((o) => o.value === selected)?.label ?? "no flair"}`}
                >
                  <FlairName key={selected} name={user.name} flair={selected} active />
                </span>
              </div>
              <p className="mt-2 text-[12px] text-ink-3">
                Preview: {FLAIR_OPTIONS.find((o) => o.value === selected)?.label ?? "No flair"}
                {HOVER_FLAIRS.has(selected) ? ". Others see it when they point at your name." : ""}
              </p>
            </>
          ) : null}
          <SaveBar
            dirty={draft !== null && draft !== saidFlair}
            pending={pending}
            saved={saved}
            error={saveError}
            onSave={save}
          />
        </SettingsPanel>
      </SettingsSection>
    </div>
  );
}
