"use client";

import * as React from "react";
import { Button, ComboBox, Input, Label, ListBox } from "@heroui/react";
import { Page } from "@/components/ui";
import {
  SaveBar,
  PasswordGate, SettingsGate,
  SettingsPanel,
  SettingsSection,
  useSave,
} from "@/components/settings/settings-kit";
import { browserTimezone, listTimezones, matchZone, sameZone } from "@/components/settings/format";
import { useApi, useAuth } from "@/lib/auth";

export default function TimezoneSettingsPage() {
  return (
    <Page title="Timezone" subtitle="Used for local times in your statistics and when your daily playlists are made.">
      <PasswordGate what="your timezone">
        <SettingsGate what="change your timezone">{(user) => <TimezoneForm token={user.token} />}</SettingsGate>
      </PasswordGate>
    </Page>
  );
}

function TimezoneForm({ token }: { token: string }) {
  const api = useApi();
  const { account } = useAuth();
  // ListenBrainz's own list (PostgreSQL names, e.g. Europe/Kyiv); the browser's list only as a fallback.
  const savedZone = account?.timezone;
  const fromLB = account?.timezones;
  const zones = React.useMemo(() => {
    const list = fromLB?.length ? fromLB : listTimezones();
    return savedZone && !list.includes(savedZone) ? [savedZone, ...list] : list;
  }, [fromLB, savedZone]);
  // The browser's zone as ListenBrainz names it (Europe/Kiev in the browser is Europe/Kyiv there).
  const browserZone = matchZone(zones, browserTimezone());
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
            ? "Saved on ListenBrainz."
            : "Saved on ListenBrainz."
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
                {zones.map((z) => (
                  <ListBox.Item key={z} id={z} textValue={z}>
                    {z}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </ComboBox.Popover>
          </ComboBox>
          {browserZone && !sameZone(browserZone, zone) ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
              <span>
                Your browser is set to <span className="num text-ink-2">{browserZone}</span>.
              </span>
              <Button size="sm" variant="tertiary" onPress={() => setZone(browserZone)}>
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
