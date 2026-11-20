"use client";

/*
  The chrome of a public profile: identity row, all-time totals, section tabs. Everything here is
  readable signed out. Follow and taste match appear only when signed in and viewing someone else.
*/

import * as React from "react";
import { usePathname } from "next/navigation";
import { format } from "date-fns";
import { Button, toast } from "@heroui/react";
import { gravatarUrl, sharedAvatarUrl, useAuth } from "@/lib/auth";
import { useLB } from "@/lib/use-lb";
import { useMBProfile } from "@/lib/mb-profile";
import { fmtInt, toDate } from "@/lib/format";
import { NavTabs, UserAvatar, cx } from "@/components/ui";
import { FlairName } from "@/components/ui/flair-name";
import { FollowButton } from "@/components/user/follow-button";
import { fetchListensPage, sameUser, similarityPercent } from "@/components/user/data";
import { useProfileTotals } from "@/components/user/profile-totals";
import { useUserName } from "@/components/user/use-user-name";

export function ProfileShell({ children }: { children: React.ReactNode }) {
  const name = useUserName();
  const pathname = usePathname();
  const { user, account } = useAuth();
  const base = `/user/${encodeURIComponent(name)}`;
  const isMe = sameUser(user?.name, name);
  const signedInOther = !!user && !isMe ? user.name : null;

  const totals = useProfileTotals(name);
  const mb = useMBProfile(name);
  const mbProfile = mb.data ?? undefined;
  // MusicBrainz no longer hosts pictures: your own Gravatar on your profile, or one its owner shared through Undertone.
  const avatarSrc = isMe && account?.gravatarHash ? gravatarUrl(account.gravatarHash, 128) : sharedAvatarUrl(name, 128);
  const location = mbProfile?.location;
  const memberSince = mbProfile?.memberSince;
  const first = useLB(["user-listens", name, 0, 0], (api) => fetchListensPage(api, name));
  const oldest = first.data?.oldestListenTs ?? 0;

  const followers = useLB(["followers", name], (api) => api.getFollowersOfUser(name));
  // Donors' name flairs, the same list ListenBrainz uses.
  const flairs = useLB(["all-flairs"], (api) => api.getUserFlairs());
  const compat = useLB(signedInOther ? ["compat", signedInOther, name] : null, async (api) => {
    if (!signedInOther) return null;
    return api.getSimilarityBetweenUsers(signedInOther, name);
  });

  const following = !!user && !!followers.data?.followers.some((f) => sameUser(f, user.name));
  const similarity = compat.data?.payload?.similarity;

  // Section is the segment after the username: /user/{u}/stats -> "stats". The bare profile is the overview.
  const section = pathname.split("/")[3] ?? "";
  const active = section === "" ? "overview" : section;

  const items = [
    { key: "overview", label: "Overview", href: base },
    { key: "listens", label: "Listens", href: `${base}/listens` },
    { key: "stats", label: "Stats", href: `${base}/stats` },
    { key: "taste", label: "Taste", href: `${base}/taste` },
    { key: "playlists", label: "Playlists", href: `${base}/playlists` },
    { key: "recommendations", label: "Recommendations", href: `${base}/recommendations` },
    { key: "year-in-music", label: "Year in music", href: `${base}/year-in-music` },
  ];

  const tiles = [
    { label: "Listens", value: totals.listens },
    { label: "Artists", value: totals.artists },
    { label: "Albums", value: totals.albums },
    { label: "Tracks", value: totals.tracks },
    { label: "Loved", value: totals.loved },
  ];

  const share = async () => {
    const url = `${window.location.origin}${base}`;
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: `${name}'s music profile`, url });
        return;
      } catch (e) {
        // Dismissing the share sheet is not an error; anything else falls back to copying.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.danger("Couldn't copy the link", { description: url });
    }
  };

  return (
    <div className="flex flex-col gap-[14px]">
      <header className="flex flex-col gap-4 pb-1 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <UserAvatar name={name} size={64} src={avatarSrc} />
          <div className="min-w-0">
            <h1 className="truncate text-[24px] font-semibold leading-8 tracking-[-0.01em]">
              <FlairName name={name} flair={flairs.data?.[name] as string | undefined} />
            </h1>
            {oldest ? (
              <p className="text-[14px] text-ink-3">
                Listening since {format(toDate(oldest), "d MMMM yyyy")}
              </p>
            ) : null}
            {location || memberSince ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] leading-5 text-ink-3">
                {location ? <span className="min-w-0 break-words">{location}</span> : null}
                {location && memberSince ? <span aria-hidden>·</span> : null}
                {memberSince ? (
                  <span className="min-w-0 break-words">MusicBrainz member since {memberSinceText(memberSince)}</span>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {signedInOther ? (
            <span className="num whitespace-nowrap text-[14px] text-ink-2">
              Taste match <span className="text-white">{similarity != null ? similarityPercent(similarity) : "—"}</span>
            </span>
          ) : null}
          <Button size="sm" variant="secondary" className="whitespace-nowrap" onPress={share}>
            Share
          </Button>
          {signedInOther && !followers.isLoading ? (
            <FollowButton name={name} following={following} onChanged={() => followers.mutate()} />
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-[20px] bg-card px-[22px] py-5 sm:grid-cols-5 sm:gap-x-0 sm:divide-x sm:divide-[#1f1f1f]">
        {tiles.map((t, i) => (
          <div
            key={t.label}
            className={cx("min-w-0 sm:px-[22px] sm:first:pl-0", i === 0 && "col-span-2 sm:col-span-1")}
          >
            <div className="num truncate text-[22px] font-medium leading-8 sm:text-[24px]">{fmtInt(t.value)}</div>
            <div className="text-[12px] text-ink-3">{t.label}</div>
          </div>
        ))}
      </div>

      <NavTabs items={items} active={active} />

      {children}
    </div>
  );
}

/** "2026-03-07 23:43 UTC" -> "7 March 2026", the same way "Listening since" is written. */
function memberSinceText(raw: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return /^\d/.test(raw) ? raw : raw.charAt(0).toLowerCase() + raw.slice(1);
  return format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), "d MMMM yyyy");
}
