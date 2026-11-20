"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Description,
  Input,
  Label,
  Tabs,
  TextField,
} from "@heroui/react";
import { useAuth } from "@/lib/auth";
import { LB_WEB_URL, REPO_URL } from "@/lib/config";
import { Mark } from "@/components/shell/top-bar";

const linkCls = "text-white underline underline-offset-2 hover:text-ink-2";

export default function LoginPage() {
  const { user, account } = useAuth();
  const router = useRouter();
  // Someone on a token may come here to upgrade to a password sign-in, so only a full sign-in moves on.
  const tokenOnly = !!user && account === null;

  React.useEffect(() => {
    if (user && account) router.replace("/feed");
  }, [user, account, router]);

  return (
    <div className="mx-auto grid max-w-[1152px] gap-[14px] pt-10 md:grid-cols-[1fr_1fr]">
      <section className="rounded-[20px] bg-card p-[22px] md:p-8">
        <div className="mb-5 flex items-center gap-3">
          <Mark size={28} />
          <h1 className="text-[20px] font-semibold">Sign in to ListenBrainz</h1>
        </div>
        {tokenOnly ? (
          <p className="mb-5 rounded-[12px] bg-raised px-4 py-3 text-[14px] leading-5 text-ink-2">
            You&apos;re signed in as <span className="text-white">{user.name}</span> with a token. Sign in with your
            password to use the player and change your settings.
          </p>
        ) : null}
        <Tabs className="w-full">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Sign-in method">
              <Tabs.Tab id="password">
                Password
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="token">
                Token
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="password" className="pt-5">
            <PasswordForm onDone={() => router.replace("/feed")} />
          </Tabs.Panel>
          <Tabs.Panel id="token" className="pt-5">
            <TokenForm onDone={() => router.replace("/feed")} />
          </Tabs.Panel>
        </Tabs>
      </section>
      <StoragePanel />
    </div>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const { signInWithPassword } = useAuth();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, setPending] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await signInWithPassword(username, password);
      setPassword("");
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-[14px] leading-5 text-ink-2">
        Your MetaBrainz account, the same one you use on listenbrainz.org and
        musicbrainz.org. This also lets Undertone read your settings and email,
        which the token can&apos;t.
      </p>
      <TextField
        isRequired
        value={username}
        onChange={(v) => {
          setUsername(v);
          setError(undefined);
        }}
        className="flex flex-col gap-2"
      >
        <Label>Username</Label>
        <Input autoComplete="username" spellCheck={false} className="h-10" />
      </TextField>
      <TextField
        isRequired
        value={password}
        onChange={(v) => {
          setPassword(v);
          setError(undefined);
        }}
        isInvalid={!!error}
        className="flex flex-col gap-2"
      >
        <Label>Password</Label>
        <Input
          type="password"
          autoComplete="current-password"
          className="h-10"
        />
        <Description>
          Sent once to metabrainz.org through Undertone&apos;s server, then
          forgotten. Never stored.
        </Description>
      </TextField>
      {error ? (
        <p role="alert" className="text-[14px] text-negative">
          {error}
        </p>
      ) : null}
      <div>
        <Button
          type="submit"
          isDisabled={!username.trim() || !password || pending}
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        {pending ? <SignInProgress /> : null}
      </div>
    </form>
  );
}

/*
  What the server is doing while you wait. ListenBrainz gives no progress, so the steps advance on a
  timer set from real sign-ins (MetaBrainz ~1 s, then listenbrainz.org for the rest); the
  sweeping bar and the seconds counter show the page is alive even when a step runs long.
*/
const STEPS = [
  { label: "Checking your password with MetaBrainz", until: 2 },
  { label: "Signing you in on listenbrainz.org", until: Infinity },
];

function SignInProgress() {
  const [seconds, setSeconds] = React.useState(0);
  React.useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(t);
  }, []);
  const current = STEPS.findIndex((s) => seconds < s.until);

  return (
    <div role="status" aria-live="polite" className="mt-4 rounded-[14px] bg-raised p-4">
      <div className="relative mb-4 h-1 overflow-hidden rounded-full bg-[#2a2a2a]">
        <div className="signin-sweep absolute inset-y-0 left-0 w-2/5 rounded-full bg-white" />
      </div>
      <ol className="flex flex-col gap-2.5">
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step.label} className="flex items-center gap-3 text-[14px] leading-5">
              <span aria-hidden className="flex size-4 flex-none items-center justify-center">
                {done ? (
                  <svg viewBox="0 0 16 16" className="size-4 text-white">
                    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : active ? (
                  <span className="signin-pulse size-2.5 rounded-full bg-white" />
                ) : (
                  <span className="size-2 rounded-full bg-[#3a3a3a]" />
                )}
              </span>
              <span className={done ? "text-ink-2" : active ? "text-white" : "text-ink-3"}>
                {step.label}
                {active ? "…" : null}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="num mt-4 text-[13px] text-ink-3">
        {seconds}s · usually under half a minute
        {seconds >= 40 ? ". listenbrainz.org is slower than usual today; it will finish or give up within a minute." : ""}
      </p>
    </div>
  );
}

function TokenForm({ onDone }: { onDone: () => void }) {
  const { signIn } = useAuth();
  const [token, setToken] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, setPending] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await signIn(token);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextField
        isRequired
        value={token}
        onChange={(v) => {
          setToken(v);
          setError(undefined);
        }}
        isInvalid={!!error}
        className="flex flex-col gap-2"
      >
        <Label>User token</Label>
        <Input
          type="password"
          autoComplete="off"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="h-10"
        />
        <Description>
          Copy it from{" "}
          <a
            className={linkCls}
            href={`${LB_WEB_URL}/settings/`}
            target="_blank"
            rel="noreferrer"
          >
            listenbrainz.org/settings
          </a>
          . It is kept in this browser and sent only to api.listenbrainz.org.
          Undertone can&apos;t read your settings with a token, because
          ListenBrainz doesn&apos;t allow it.
        </Description>
      </TextField>
      {error ? (
        <p role="alert" className="text-[14px] text-negative">
          {error}
        </p>
      ) : null}
      <div>
        <Button type="submit" isDisabled={!token.trim() || pending}>
          {pending ? "Checking…" : "Sign in"}
        </Button>
      </div>
    </form>
  );
}

/** The plain statement of what is and isn't kept. Shown next to both sign-in forms. */
function StoragePanel() {
  return (
    <section className="rounded-[20px] bg-card p-[22px] text-[14px] leading-6 text-ink-2 md:p-8">
      <h2 className="mb-1 text-[16px] font-medium text-white">
        Undertone&apos;s server keeps almost nothing about you
      </h2>
      <p className="mb-4">
        No database, no accounts, no logs of your data. The only thing it keeps
        is your Gravatar key, and only if you sign in with your password.
        You can check every line of it.
      </p>
      <ul className="flex flex-col gap-3">
        <li>
          <span className="text-white">Your password</span> is used for one
          request to metabrainz.org, made by Undertone&apos;s server because
          browsers don&apos;t allow other sites to log in there. It is not
          saved, logged or sent anywhere else.
        </li>
        <li>
          <span className="text-white">Your ListenBrainz session</span> is
          handed straight back to your browser as a cookie that only Undertone&apos;s
          pages can use. The server uses it for each request and keeps no copy. Signing
          out deletes the cookie and logs you out on listenbrainz.org.
        </li>
        <li>
          <span className="text-white">Your settings and email</span> are read
          from listenbrainz.org when you open Undertone and held in memory until
          you close the tab. Changes are saved to ListenBrainz, never here.
        </li>
        <li>
          <span className="text-white">Your profile picture</span>: after a
          password sign-in the server keeps your Gravatar key (made from your
          email, not the email itself), so your profile shows your Gravatar.
          Turn it off in Account settings and the key is deleted.
        </li>
        <li>
          <span className="text-white">With a token</span>, everything goes
          straight from your browser to api.listenbrainz.org and
          Undertone&apos;s server isn&apos;t involved.
        </li>
        <li>
          <span className="text-white">The one thing the server caches</span> is
          public MusicBrainz profile pages (the avatar, bio and links anyone can
          see on musicbrainz.org), for up to a day.
        </li>
      </ul>
      <p className="mt-4">
        Undertone is open source:{" "}
        <a className={linkCls} href={REPO_URL} target="_blank" rel="noreferrer">
          github.com/foxgirlsorg/undertone
        </a>
        . The sign-in code is in{" "}
        <code className="text-[13px] text-white">
          src/lib/server/lb-session.ts
        </code>{" "}
        and the picture store in{" "}
        <code className="text-[13px] text-white">
          src/lib/server/avatar-store.ts
        </code>
        .
      </p>
    </section>
  );
}
