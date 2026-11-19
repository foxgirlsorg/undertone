import type { Metadata } from "next";
import { ProfileShell } from "@/components/user/profile-shell";

/*
  Server layout for a public profile. It fetches nothing: the page is rendered by the client
  ProfileShell, and only the metadata is computed here so shared links get a proper title and text.
*/

const safeDecode = (raw: string) => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const name = safeDecode(username);
  const title = `${name}'s music profile`;
  const description = `Listening history, top artists, albums and tracks of ${name} on ListenBrainz.`;
  const url = `/user/${encodeURIComponent(name)}`;
  return {
    title,
    description,
    openGraph: { title, description, url },
    twitter: { card: "summary", title, description },
  };
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <ProfileShell>{children}</ProfileShell>;
}
