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
  const { user } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (user) router.replace("/feed");
  }, [user, router]);

  return (
    <div className="mx-auto grid max-w-[1152px] gap-[14px] pt-10 md:grid-cols-[1fr_1fr]">
      <section className="rounded-[20px] bg-card p-[22px] md:p-8">
        <div className="mb-5 flex items-center gap-3">
          <Mark size={28} />
          <h1 className="text-[20px] font-semibold">Sign in to ListenBrainz</h1>
        </div>
        <Tabs className="w-full">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Sign-in method">
              <Tabs.Tab id="password">
                Username and password
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
      </div>
    </form>
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
        Undertone&apos;s server stores nothing about you
      </h2>
      <p className="mb-4">
        No database, no accounts, no logs of your data. You can check every line
        of it.
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
          handed straight back to your browser as a cookie only Undertone&apos;s
          server can read when you send it. The server keeps no copy. Signing
          out deletes the cookie and logs you out on listenbrainz.org.
        </li>
        <li>
          <span className="text-white">Your settings and email</span> are read
          from listenbrainz.org when you open Undertone and held in memory until
          you close the tab. Changes are saved to ListenBrainz, never here.
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
        </code>
        .
      </p>
    </section>
  );
}
