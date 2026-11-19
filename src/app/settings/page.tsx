"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { Page, Link } from "@/components/ui";
import { OutButton, SettingsGate, SettingsPanel, SettingsSection } from "@/components/settings/settings-kit";
import { maskToken } from "@/components/settings/format";
import { useAuth } from "@/lib/auth";
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
        description="Your ListenBrainz username. It is set on listenbrainz.org, so it cannot be changed here."
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
        description="Your MetaBrainz email address, shown only to you. ListenBrainz shares it only with your own session, so Undertone can show it after a password sign-in. It is never stored."
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

      <SettingsSection
        title="Signed in with"
        description={
          account
            ? "Your MetaBrainz username and password. Undertone's server used the password once and kept nothing; your listenbrainz.org session is a cookie in this browser."
            : "Your ListenBrainz token. Undertone's server is not involved."
        }
      >
        <SettingsPanel>
          <p className="text-[14px] leading-5 text-ink-2">
            Undertone&apos;s server stores nothing about you.{" "}
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
            ? "Read from your listenbrainz.org session each time you open Undertone, and held in memory only. It is sent only to api.listenbrainz.org."
            : "Undertone signs each request with this token. It is kept only in this browser and is sent only to api.listenbrainz.org."
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
            Need a new token? Resetting it needs a session on listenbrainz.org, so it happens there. The old token stops
            working everywhere, including here: sign out and paste the new one.
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
            ? "Deletes the session cookie from this browser and logs you out on listenbrainz.org."
            : "Removes the token from this browser. Your ListenBrainz account is not affected."
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
