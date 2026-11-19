import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/shell/providers";
import { TopBar } from "@/components/shell/top-bar";
import { PlayerBar } from "@/components/player/player-bar";
import { SiteFooter } from "@/components/shell/site-footer";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  // Absolute base for share previews. Set NEXT_PUBLIC_SITE_URL to the deployed origin.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Undertone", template: "%s · Undertone" },
  description: "A fast, quiet client for ListenBrainz: your listens, stats, playlists and recommendations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`} data-theme="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-black text-white antialiased">
        <Providers>
          <TopBar />
          <main className="mx-auto w-full max-w-[1152px] px-4 pb-32 sm:px-6 xl:px-0">{children}</main>
          <SiteFooter />
          <PlayerBar />
        </Providers>
      </body>
    </html>
  );
}
