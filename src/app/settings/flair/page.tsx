"use client";

import * as React from "react";
import { ListBox, Label, Select } from "@heroui/react";
import { ErrorNote, Link, Loading, Page, cx } from "@/components/ui";
import { SaveBar, SettingsGate, SettingsPanel, SettingsSection, useSave } from "@/components/settings/settings-kit";
import { useLB } from "@/lib/use-lb";
import { FlairEnum, type Flair } from "@/lib/enums";
import { useApi, useAuth, type AuthUser } from "@/lib/auth";

export default function FlairSettingsPage() {
  return (
    <Page title="Flair" subtitle="A small name effect shown next to your username.">
      <SettingsGate what="choose a flair">{(user) => <FlairForm user={user} />}</SettingsGate>
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

// Only a few flairs get a preview effect; the rest are named. Transform-only, no gradients.
const PREVIEWED: Flair[] = ["shake", "wave", "flip-horizontal", "flip-vertical"];

const PREVIEW_CSS = `
@keyframes ub-flair-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
@keyframes ub-flair-wave { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes ub-flair-flip-h { 0%,100% { transform: scaleX(1); } 50% { transform: scaleX(-1); } }
@keyframes ub-flair-flip-v { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(-1); } }
.ub-flair-preview { display: inline-block; font-size: 20px; font-weight: 500; }
.ub-flair-shake { animation: ub-flair-shake 0.6s ease-in-out infinite; }
.ub-flair-wave { animation: ub-flair-wave 1.2s ease-in-out infinite; }
.ub-flair-flip-horizontal { animation: ub-flair-flip-h 2.4s ease-in-out infinite; }
.ub-flair-flip-vertical { animation: ub-flair-flip-v 2.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .ub-flair-preview { animation: none !important; } }
`;

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
      <style>{PREVIEW_CSS}</style>
      <SettingsSection
        title="Your flair"
        description={
          <>
            Flairs are a perk for donors. A donation unlocks them for a month or longer, and{" "}
            <Link href="/donors" className="text-ink-2 underline underline-offset-2">
              the donors page
            </Link>{" "}
            explains how.
          </>
        }
        summary={
          unlocked === undefined
            ? null
            : unlocked
              ? "Unlocked. Your flair is shown next to your name."
              : "Locked. You can pick one now, but it shows after your next donation."
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
                  className={cx("ub-flair-preview", PREVIEWED.includes(selected) && `ub-flair-${selected}`)}
                  aria-label={`Preview of ${user.name} with ${FLAIR_OPTIONS.find((o) => o.value === selected)?.label ?? "no flair"}`}
                >
                  {user.name}
                </span>
              </div>
              <p className="mt-2 text-[12px] text-ink-3">
                Preview: {FLAIR_OPTIONS.find((o) => o.value === selected)?.label ?? "No flair"}
                {PREVIEWED.includes(selected) ? "" : ". This flair is shown as a name only in the preview."}
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
