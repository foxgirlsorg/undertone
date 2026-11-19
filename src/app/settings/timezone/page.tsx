"use client";

import * as React from "react";
import { Button, ComboBox, Input, Label, ListBox } from "@heroui/react";
import { Page } from "@/components/ui";
import {
  SaveBar,
  SettingsGate,
  SettingsPanel,
  SettingsSection,
  useSave,
} from "@/components/settings/settings-kit";
import { browserTimezone, listTimezones } from "@/components/settings/format";
import { useApi, useAuth } from "@/lib/auth";

export default function TimezoneSettingsPage() {
  return (
    <Page title="Timezone" subtitle="Used for local times in your statistics and when your daily playlists are made.">
      <SettingsGate what="change your timezone">{(user) => <TimezoneForm token={user.token} />}</SettingsGate>
    </Page>
  );
}

const ZONES = listTimezones();

function TimezoneForm({ token }: { token: string }) {
  const api = useApi();
  const { account } = useAuth();
  const browserZone = browserTimezone();
  // Known only with a password sign-in; with a token ListenBrainz can't hand it back, so nothing is pre-selected.
  const known = account?.timezone ?? null;
  const [zone, setZone] = React.useState<string | null>(known);
  // The value on ListenBrainz as far as this page knows; "dirty" means the selection differs from it.
  const [baseline, setBaseline] = React.useState<string | null>(known);

  const { save, pending, saved, error } = useSave(async () => {
    if (!zone) throw new Error("Choose a timezone first.");
    await api.resetUserTimezone(token, zone);
    setBaseline(zone);
  });

  return (
    <div>
      <SettingsSection
        title="Your timezone"
        description={
          account
            ? "The timezone saved on your ListenBrainz account. Pick another and save to change it."
            : "With a token, Undertone can't read the timezone saved on your account, so choose one here and save it. Sign in with your password to see it."
        }
        summary={zone ? <>Selected: <span className="num text-white">{zone}</span></> : "No timezone selected yet."}
      >
        <SettingsPanel>
          <ComboBox
            aria-label="Timezone"
            selectedKey={zone}
            onSelectionChange={(key) => setZone(key == null ? null : String(key))}
            className="w-full"
          >
            <Label>Timezone</Label>
            <ComboBox.InputGroup>
              <Input placeholder="Search, for example Europe/Paris" />
              <ComboBox.Trigger />
            </ComboBox.InputGroup>
            <ComboBox.Popover>
              <ListBox>
                {ZONES.map((z) => (
                  <ListBox.Item key={z} id={z} textValue={z}>
                    {z}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </ComboBox.Popover>
          </ComboBox>
          {browserZone && browserZone !== zone ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
              <span>
                Your browser is set to <span className="num text-ink-2">{browserZone}</span>.
              </span>
              <Button size="sm" variant="tertiary" onPress={() => setZone(browserZone)} isDisabled={!ZONES.includes(browserZone)}>
                Use it
              </Button>
            </div>
          ) : null}
          <SaveBar
            dirty={zone !== baseline}
            pending={pending}
            saved={saved}
            error={error}
            onSave={save}
          />
        </SettingsPanel>
      </SettingsSection>
    </div>
  );
}
