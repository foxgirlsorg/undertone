"use client";

import * as React from "react";
import { Button, toast } from "@heroui/react";
import { useAuth } from "@/lib/auth";

/** Follow / Following toggle for another user. Parent owns the follow state and refreshes it via onChanged. */
export function FollowButton({
  name,
  following,
  onChanged,
}: {
  name: string;
  following: boolean;
  onChanged: () => void;
}) {
  const { api, user } = useAuth();
  const [busy, setBusy] = React.useState(false);

  if (!user) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      const { status } = following
        ? await api.unfollowUser(name, user.token)
        : await api.followUser(name, user.token);
      if (status !== 200) throw new Error(`ListenBrainz answered ${status}.`);
      onChanged();
    } catch (e) {
      toast.danger(following ? "Couldn't unfollow" : "Couldn't follow", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      className="whitespace-nowrap"
      variant={following ? "secondary" : "primary"}
      isDisabled={busy}
      onPress={toggle}
    >
      {following ? "Unfollow" : "Follow"}
    </Button>
  );
}
