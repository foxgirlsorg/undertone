"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { Page, Link, SwitchRow, UserAvatar } from "@/components/ui";
import { OutButton, SettingsGate, SettingsPanel, SettingsSection } from "@/components/settings/settings-kit";
import { maskToken } from "@/components/settings/format";
import { gravatarUrl, useAuth } from "@/lib/auth";
import { LB_WEB_URL, REPO_URL } from "@/lib/config";

export default function AccountSettingsPage() {
  return (
    <Page title="Account" subtitle="Who you are on ListenBrainz and how Undertone signs in.">
      <SettingsGate what="see your account settings">{(user) => <AccountForm name={user.name} token={user.token} />}</SettingsGate>
    </Page>
  );
}

function AccountForm({ name, token }: { name: string; token: string }) {
  const { signOut, account } = useAuth();
  const router = useRouter();
  const [reveal, setReveal] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState<string>();
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const copyToken = async () => {
    setCopyError(undefined);
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Copy is blocked in this browser. Select the token and copy it by hand.");
    }
  };

  const onSignOut = () => {
    signOut();
    router.push("/login");
  };

  return (
    <div>
      <SettingsSection
        title="Username"
        description="Set on listenbrainz.org; it can't be changed here."
      >
        <SettingsPanel className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[16px] font-medium">{name}</span>
          <Link href={`/user/${encodeURIComponent(name)}`} muted className="text-[14px]">
            View profile
          </Link>
        </SettingsPanel>
      </SettingsSection>

      <SettingsSection
        title="Email"
        description="Shown only to you. Never stored."
      >
        <SettingsPanel className="flex flex-wrap items-center justify-between gap-3">
          {account ? (
            <>
              <span className="min-w-0 break-all text-[16px]">{account.email ?? "No email on your account"}</span>
              <span className="text-[13px] text-ink-3">
                {account.email ? (account.emailVerified ? "Verified" : "Not verified") : null}
              </span>
            </>
          ) : (
            <span className="text-[14px] text-ink-2">
              Signed in with a token, which can&apos;t read your email.{" "}
              <Link href="/login" className="text-[14px]">
                Sign in with your password
              </Link>{" "}
              to see it.
            </span>
          )}
        </SettingsPanel>
        {account ? (
          <div className="mt-3">
            <OutButton href="https://metabrainz.org/profile">Change it on MetaBrainz</OutButton>
          </div>
        ) : null}
      </SettingsSection>

      <ProfilePicture name={name} />

      <SettingsSection
        title="Signed in with"
        description={
          account
            ? "Your MetaBrainz password, used once and never stored."
            : "Your ListenBrainz token, kept in this browser."
        }
      >
        <SettingsPanel>
          <p className="text-[14px] leading-5 text-ink-2">
            The server keeps nothing about you except your shared profile picture.{" "}
            <Link href={REPO_URL} className="text-[14px]">
              Read the source
            </Link>
            .
          </p>
        </SettingsPanel>
      </SettingsSection>

      <SettingsSection
        title="User token"
        description={
          account
            ? "Read from your session, held in memory, sent only to ListenBrainz."
            : "Kept in this browser, sent only to ListenBrainz."
        }
      >
        <SettingsPanel>
          <div className="flex flex-wrap items-center gap-2">
            <code className="num min-w-0 flex-1 break-all rounded-[10px] bg-raised px-3 py-2 text-[13px] text-ink-2">
              {reveal ? token : maskToken(token)}
            </code>
            <Button variant="secondary" size="sm" onPress={() => setReveal((v) => !v)} aria-pressed={reveal}>
              {reveal ? "Hide" : "Show"}
            </Button>
            <Button variant="secondary" size="sm" onPress={copyToken}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          {copyError ? (
            <p role="alert" className="mt-2 text-[13px] text-negative">
              {copyError}
            </p>
          ) : null}
        </SettingsPanel>
        <div className="mt-4">
          <p className="text-[14px] leading-5 text-ink-2">
            Resetting happens on listenbrainz.org. The old token then stops working here too.
          </p>
          <div className="mt-3">
            <OutButton href={`${LB_WEB_URL}/settings/resettoken/`}>Reset token on ListenBrainz</OutButton>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Sign out"
        description={
          account
            ? "Also logs you out on listenbrainz.org."
            : "Removes the token from this browser."
        }
      >
        <SettingsPanel className="flex justify-end">
          <Button variant="danger-soft" onPress={onSignOut}>
            Sign out
          </Button>
        </SettingsPanel>
      </SettingsSection>
    </div>
  );
}

/** "Show my picture to others": the one thing Undertone's server stores (src/lib/server/avatar-store.ts). */
function ProfilePicture({ name }: { name: string }) {
  const { account, setAvatarShared } = useAuth();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();

  const change = async (shared: boolean) => {
    setPending(true);
    setError(undefined);
    try {
      await setAvatarShared(shared);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <SettingsSection
      title="Profile picture"
      description="Your Gravatar, from your MetaBrainz email."
    >
      <SettingsPanel>
        {!account ? (
          <p className="text-[14px] leading-5 text-ink-2">
            Signed in with a token, which can&apos;t read your email, so Undertone can&apos;t find your Gravatar.{" "}
            <Link href="/login" className="text-[14px]">
              Sign in with your password
            </Link>{" "}
            to show it.
          </p>
        ) : !account.gravatarHash ? (
          <p className="text-[14px] leading-5 text-ink-2">Your MetaBrainz account has no email, so there is no Gravatar to show.</p>
        ) : (
          <div className="flex items-start gap-4">
            <UserAvatar name={name} size={48} src={gravatarUrl(account.gravatarHash, 96)} />
            <div className="min-w-0 flex-1">
              <SwitchRow
                label="Show my picture to others"
                description="Shows your Gravatar on your profile. Undertone keeps only its key; turning this off deletes it."
                isSelected={!!account.avatarShared}
                isDisabled={pending}
                onChange={change}
              />
              {error ? (
                <p role="alert" className="mt-2 text-[13px] text-negative">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </SettingsPanel>
    </SettingsSection>
  );
}
