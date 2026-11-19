"use client";

import * as React from "react";
import { Toast } from "@heroui/react";
import { AuthProvider } from "@/lib/auth";
import { PlayerProvider } from "@/components/player/player-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PlayerProvider>
        {children}
        <Toast.Provider placement="top end" className="top-14" />
      </PlayerProvider>
    </AuthProvider>
  );
}
