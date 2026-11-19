"use client";

/* The areas of /settings. Each is its own route. Phone: a horizontal scroll row. Desktop: a left list. */

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export const SETTINGS_AREAS: Array<{ href: string; label: string }> = [
  { href: "/settings", label: "Account" },
  { href: "/settings/timezone", label: "Timezone" },
  { href: "/settings/recommendations", label: "Recommendations" },
  { href: "/settings/player", label: "Player" },
  { href: "/settings/flair", label: "Flair" },
  { href: "/settings/import", label: "Import listens" },
  { href: "/settings/export", label: "Export" },
  { href: "/settings/link-listens", label: "Link listens" },
  { href: "/settings/delete-listens", label: "Delete listens" },
  { href: "/settings/music-services", label: "Music services" },
  { href: "/settings/delete-account", label: "Delete account" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Settings areas"
      className="-mx-1 flex gap-1 overflow-x-auto px-1 md:sticky md:top-6 md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:px-0"
    >
      {SETTINGS_AREAS.map((area) => {
        const on = pathname === area.href;
        return (
          <NextLink
            key={area.href}
            href={area.href}
            aria-current={on ? "page" : undefined}
            className={cx(
              "flex h-11 flex-none items-center whitespace-nowrap rounded-full px-3 text-[14px] transition-colors md:h-9 md:rounded-[10px]",
              on ? "bg-raised font-medium text-white" : "text-ink-2 hover:bg-[#1c1c1c] hover:text-white"
            )}
          >
            {area.label}
          </NextLink>
        );
      })}
    </nav>
  );
}
