"use client";

/* Spotify redirects here after sign-in. Exchanges the code, then returns to the player settings. */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@heroui/react";
import { Link, Loading, Page } from "@/components/ui";
import { handleSpotifyCallback } from "@/lib/spotify";

/* Module-level guard: React's development double-run of effects must not spend the one-time code twice. */
let handledCode: string | null = null;

export default function SpotifyCallbackPage() {
  const router = useRouter();
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const denied = params.get("error");

    const finish: Promise<void> = denied
      ? Promise.reject(new Error(denied === "access_denied" ? "Spotify sign-in was cancelled." : "Spotify sign-in failed."))
      : !code
        ? Promise.reject(new Error("Spotify did not send a sign-in code. Connect Spotify again from the player settings."))
        : handledCode === code
          ? Promise.resolve()
          : ((handledCode = code),
            handleSpotifyCallback(code, state).then(() => {
              toast.success("Spotify connected");
              router.replace("/settings/player");
            }));
    finish.catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Spotify sign-in failed.");
    });
  }, [router]);

  return (
    <Page title="Spotify" subtitle="Finishing the Spotify sign-in.">
      {error ? (
        <div className="rounded-[16px] bg-card p-[22px] text-[14px]">
          <p className="text-ink-2">{error}</p>
          <p className="mt-3">
            <Link href="/settings/player">Back to the player settings</Link>
          </p>
        </div>
      ) : (
        <Loading label="Connecting Spotify" />
      )}
    </Page>
  );
}
