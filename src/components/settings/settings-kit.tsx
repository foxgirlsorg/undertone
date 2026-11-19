"use client";

/*
  Settings building blocks ("two columns" pattern).
  - SettingsSection: a row. Label column (title, grey description, optional summary of the current
    value) beside a panel. Rows are split by a 1px #1f1f1f rule with 32px above and below. Phone: stacks.
  - SettingsPanel: #111 card, radius 16, padding 16, no border.
  - SaveBar: one Save per panel, bottom right; a quiet "Saved" stamp; errors inline; a disabled Save says why.
  - SettingsGate: sign-in gate for areas that need a token.
*/

import * as React from "react";
import { Button } from "@heroui/react";
import { cx, Loading, SignInPrompt } from "@/components/ui";
import { useAuth, type AuthUser } from "@/lib/auth";

export function SettingsSection({
  title,
  description,
  summary,
  children,
  id,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** A one-line summary of the current value, shown under the description. */
  summary?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="mt-8 grid gap-4 border-t border-[#1f1f1f] pt-8 first:mt-0 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-x-8"
    >
      <div className="min-w-0">
        <h2 className="text-[16px] font-medium leading-6">{title}</h2>
        {description ? <div className="mt-1 text-[14px] leading-5 text-ink-3">{description}</div> : null}
        {summary ? <div className="mt-2 text-[14px] leading-5 text-ink-2">{summary}</div> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function SettingsPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("rounded-[16px] bg-card p-4", className)}>{children}</div>;
}

/** Runs an async save and remembers pending / saved / error for the SaveBar. */
export function useSave(run: () => Promise<unknown>) {
  const [pending, setPending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const save = async () => {
    setPending(true);
    setError(undefined);
    setSaved(false);
    try {
      await run();
      setSaved(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Try again.");
    } finally {
      setPending(false);
    }
  };

  return { save, pending, saved, error };
}

/** One Save per panel, bottom right. `dirty` is false until something changed. */
export function SaveBar({
  dirty,
  pending,
  saved,
  error,
  onSave,
  disabledReason,
  label = "Save",
}: {
  dirty: boolean;
  pending: boolean;
  saved: boolean;
  error?: string;
  onSave: () => void;
  /** Why saving is not possible right now (e.g. "Sign in to save."). Shown instead of "No changes". */
  disabledReason?: string;
  /** Button text, for actions that are not a save (e.g. "Start export"). */
  label?: string;
}) {
  const canSave = dirty && !pending && !disabledReason;
  const hint = disabledReason ?? (dirty ? undefined : "No changes");
  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
      <div aria-live="polite" className="mr-auto min-w-0 text-[13px]">
        {error ? (
          <span role="alert" className="text-negative">
            {error}
          </span>
        ) : saved && !dirty ? (
          <span className="text-ink-2">Saved</span>
        ) : hint ? (
          <span className="text-ink-3">{hint}</span>
        ) : null}
      </div>
      <Button onPress={onSave} isDisabled={!canSave} isPending={pending}>
        {label}
      </Button>
    </div>
  );
}

/** Gate for areas that need the signed-in user. Children get the user (with token). */
export function SettingsGate({
  what,
  children,
}: {
  what: string;
  children: (user: AuthUser) => React.ReactNode;
}) {
  const { user } = useAuth();
  if (user === undefined) return <Loading />;
  if (user === null) return <SignInPrompt what={what} />;
  return <>{children(user)}</>;
}

/** Flips to true after the first client render. Use to gate components that read localStorage. */
export function useMounted() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/** A button-looking link to another site (ListenBrainz website pages that need its own session). */
export function OutButton({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-[14px] font-medium transition-colors",
        primary ? "bg-white text-black hover:bg-[#e6e6e6]" : "bg-raised text-white hover:bg-[#333]"
      )}
    >
      {children}
      <span aria-hidden className="text-ink-3">
        ↗
      </span>
      <span className="sr-only">(opens listenbrainz.org)</span>
    </a>
  );
}
