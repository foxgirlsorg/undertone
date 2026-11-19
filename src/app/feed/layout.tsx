"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Loading, NavTabs, Page, SignInPrompt } from "@/components/ui";

const TABS = [
  { key: "feed", href: "/feed", label: "Your feed" },
  { key: "following", href: "/feed/following", label: "Following listens" },
  { key: "similar", href: "/feed/similar", label: "Similar listeners" },
];

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  if (user === undefined) return <Loading />;

  if (user === null) {
    return (
      <Page title="Feed">
        <SignInPrompt what="see your feed and what people you follow are listening to" />
      </Page>
    );
  }

  const active = pathname.startsWith("/feed/following")
    ? "following"
    : pathname.startsWith("/feed/similar")
      ? "similar"
      : "feed";

  return (
    <Page title="Feed">
      <NavTabs items={TABS} active={active} />
      {children}
    </Page>
  );
}
