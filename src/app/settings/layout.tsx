"use client";

import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 pt-2 md:grid-cols-[168px_minmax(0,1fr)] md:gap-10">
      <SettingsNav />
      <div className="min-w-0 max-w-[720px] pb-8">{children}</div>
    </div>
  );
}
