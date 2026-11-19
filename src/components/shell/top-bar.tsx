"use client";

import * as React from "react";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Dropdown, Label } from "@heroui/react";
import { Bars, Magnifier, Xmark } from "@gravity-ui/icons";
import { gravatarUrl, useAuth } from "@/lib/auth";
import { PRODUCT_NAME } from "@/lib/config";
import { UserAvatar, cx } from "@/components/ui";

/** Product mark: a record groove cut by one orange listening arc. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10.5" fill="#1c1c1c" />
      <circle cx="12" cy="12" r="6.5" fill="none" stroke="#3a3a3a" strokeWidth="1.2" />
      <path d="M12 1.5a10.5 10.5 0 0 1 10.5 10.5" fill="none" stroke="#eb743b" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.2" fill="#fff" />
    </svg>
  );
}

function useNav() {
  const { user } = useAuth();
  const me = user?.name;
  return [
    { href: "/feed", label: "Feed", match: (p: string) => p.startsWith("/feed"), show: !!me },
    { href: me ? `/user/${encodeURIComponent(me)}` : "/login", label: "Listens", match: (p: string) => !!me && p === `/user/${encodeURIComponent(me)}`, show: !!me },
    { href: me ? `/user/${encodeURIComponent(me)}/stats` : "/statistics", label: "Stats", match: (p: string) => /^\/user\/[^/]+\/stats/.test(p) || p.startsWith("/statistics"), show: true },
    { href: me ? `/user/${encodeURIComponent(me)}/playlists` : "/explore", label: "Playlists", match: (p: string) => /^\/user\/[^/]+\/(playlists|collaborations|recommendations)/.test(p) || p.startsWith("/playlist/") || p.startsWith("/recommended/"), show: !!me },
    { href: "/explore", label: "Explore", match: (p: string) => p.startsWith("/explore"), show: true },
  ].filter((n) => n.show);
}

export function TopBar() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { user, account, signOut } = useAuth();
  const nav = useNav();
  const [q, setQ] = React.useState("");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // Close the phone menu on navigation (derived state, no effect).
  const [menuPath, setMenuPath] = React.useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header
      className={cx(
        "sticky top-0 z-40 bg-black",
        scrolled ? "border-b border-[#1a1a1a]" : "border-b border-transparent"
      )}
    >
      <div className="mx-auto flex h-12 max-w-[1152px] items-center gap-6 px-4 sm:px-6 xl:px-0">
        <NextLink href={user ? "/feed" : "/"} className="flex h-12 flex-none items-center gap-2 font-semibold">
          <Mark />
          <span className="text-[15px]">{PRODUCT_NAME}</span>
        </NextLink>

        <nav aria-label="Main" className="hidden items-center gap-5 md:flex">
          {nav.map((n) => (
            <NextLink
              key={n.label}
              href={n.href}
              aria-current={n.match(pathname) ? "page" : undefined}
              className={cx(
                "text-[14px] font-medium transition-colors",
                n.match(pathname) ? "text-white" : "text-[#bbb] hover:text-white"
              )}
            >
              {n.label}
            </NextLink>
          ))}
        </nav>

        <form role="search" onSubmit={submit} className="ml-auto hidden md:block">
          <label className="flex h-9 w-[260px] items-center gap-2 rounded-full bg-[#161616] px-3 text-ink-3 focus-within:bg-[#1c1c1c]">
            <Magnifier className="size-4 flex-none" />
            <span className="sr-only">Search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Artists, albums, tracks, users"
              className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-ink-3"
            />
          </label>
        </form>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <NextLink href="/search" aria-label="Search" className="flex size-9 items-center justify-center rounded-full text-[#bbb] hover:text-white md:hidden">
            <Magnifier className="size-4" />
          </NextLink>
          {user ? (
            <Dropdown>
              <Button isIconOnly variant="ghost" aria-label={`Account: ${user.name}`} className="rounded-full">
                <UserAvatar name={user.name} size={30} src={gravatarUrl(account?.gravatarHash, 60)} />
              </Button>
              <Dropdown.Popover placement="bottom end">
                <Dropdown.Menu
                  onAction={(k) => {
                    const key = String(k);
                    if (key === "signout") {
                      signOut();
                      router.push("/");
                    } else router.push(key);
                  }}
                >
                  <Dropdown.Item id={`/user/${encodeURIComponent(user.name)}`} textValue="Profile">
                    <Label>{user.name}</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id={`/user/${encodeURIComponent(user.name)}/taste`} textValue="Taste">
                    <Label>Loved, hated and pins</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id={`/user/${encodeURIComponent(user.name)}/recommendations`} textValue="Recommendations">
                    <Label>Recommendations</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="/settings" textValue="Settings">
                    <Label>Settings</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="signout" textValue="Sign out">
                    <Label>Sign out</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          ) : user === null ? (
            <NextLink href="/login" className="hidden h-9 items-center rounded-full bg-white px-4 text-[14px] font-medium text-black md:inline-flex">
              Sign in
            </NextLink>
          ) : null}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex size-9 items-center justify-center rounded-full text-[#bbb] hover:text-white md:hidden"
          >
            {menuOpen ? <Xmark className="size-5" /> : <Bars className="size-5" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="fixed inset-x-0 bottom-0 top-12 z-40 overflow-y-auto bg-black px-4 pb-24 pt-4 md:hidden">
          <form role="search" onSubmit={submit} className="mb-6">
            <label className="flex h-11 items-center gap-2 rounded-full bg-[#161616] px-4 text-ink-3">
              <Magnifier className="size-4" />
              <span className="sr-only">Search</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search"
                className="w-full bg-transparent text-[16px] text-white outline-none"
              />
            </label>
          </form>
          <nav aria-label="Main" className="flex flex-col">
            {nav.map((n) => (
              <NextLink key={n.label} href={n.href} className={cx("py-3 text-[18px]", n.match(pathname) ? "text-white" : "text-[#bbb]")}>
                {n.label}
              </NextLink>
            ))}
            {user ? (
              <>
                <NextLink href="/settings" className="py-3 text-[18px] text-[#bbb]">Settings</NextLink>
                <button className="py-3 text-left text-[18px] text-[#bbb]" onClick={() => { signOut(); router.push("/"); }}>
                  Sign out
                </button>
              </>
            ) : (
              <NextLink href="/login" className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-white text-[16px] font-medium text-black">
                Sign in
              </NextLink>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
