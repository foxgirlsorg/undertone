<div align="center">

<img src="src/app/icon.svg" width="120" alt="Undertone logo" />

<h1>UNDERTONE</h1>

**An independent web client for ListenBrainz, your open music listening history.**

[![Website](https://img.shields.io/badge/Website-foxgirls.org-de6161?style=flat-square)](https://foxgirls.org)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-de6161?style=flat-square&logo=nextdotjs&logoColor=white)](package.json)
[![React](https://img.shields.io/badge/React-19.3-de6161?style=flat-square&logo=react&logoColor=white)](package.json)
[![License](https://img.shields.io/badge/License-GPL--2.0-de6161?style=flat-square)](LICENSE)

</div>

---

Undertone shows your [ListenBrainz](https://listenbrainz.org) listens, statistics, playlists and recommendations, plays them, and lets you change your ListenBrainz settings. Everything comes from the [ListenBrainz API](https://listenbrainz.readthedocs.io/), run by the non-profit [MetaBrainz Foundation](https://metabrainz.org). Music data is from [MusicBrainz](https://musicbrainz.org) and cover art from the [Cover Art Archive](https://coverartarchive.org).

Undertone is not affiliated with or endorsed by the MetaBrainz Foundation. If you use it, please consider [supporting MetaBrainz](https://metabrainz.org/donate).

## Features

- **Profiles** for anyone, with no sign-in: listens, statistics, taste, playlists, recommendations and Year in Music. Profiles are shareable links, read live from ListenBrainz and never stored.
- **A feed** of what the people you follow are playing, with pins, recommendations and follows.
- **A player** that tries your sources in your order: Spotify, Navidrome, YouTube and the Internet Archive. It uses the services you connected on ListenBrainz; Undertone has no accounts of its own.
- **Settings synced with ListenBrainz**: player sources, timezone, playlist exports and flair, read from and saved to your account.
- **Two ways to sign in**: your MetaBrainz username and password, or a ListenBrainz user token (read-only for settings and without the player).
- **Donor flairs**, ported from ListenBrainz so they look the same.
- **Your Gravatar** on your profile, if you choose to share it.
- **Built for phones too**: every page is checked at six widths, from 360px up.

## What Undertone keeps about you

There is no database. The server keeps no passwords, sessions, settings, tokens or listening data, and logs none of them. The one exception is your profile picture, described below. You can check every line.

**Signing in with a token.** Your token stays in your browser (`localStorage`), and every request goes straight from your browser to `api.listenbrainz.org`. Undertone's server is not involved.

**Signing in with your password.** ListenBrainz lets only its own website read your settings, email and connected services, and browsers don't let another site log in there. So this one step goes through Undertone's server ([`src/lib/server/lb-session.ts`](src/lib/server/lb-session.ts)):

1. Your password is sent once to `metabrainz.org/login`, as the MetaBrainz login form does, and then forgotten. It is never written anywhere, logged or sent to any other host.
2. The server follows listenbrainz.org's and musicbrainz.org's own "Log in with MetaBrainz" steps, then drops the metabrainz.org session.
3. The listenbrainz.org and musicbrainz.org cookies go back to your browser in one `HttpOnly` cookie. The server keeps no copy: each later request reads them from that cookie, uses them, and forgets them.
4. Your settings, email and connected services are read from listenbrainz.org when you open Undertone and held in memory until you close the tab. Signing out deletes the cookie and logs you out on listenbrainz.org.

**Settings** are saved to your ListenBrainz account. The two preferences ListenBrainz has no field for (volume, and "submit listens while playing") are kept in a cookie in your browser, which the server never reads.

**Music services** (Spotify, Navidrome, YouTube search) are read exactly as listenbrainz.org's own player gets them, and held in memory only. Spotify tokens are renewed through listenbrainz.org, which keeps the refresh token.

**Homepages** of new MusicBrainz editors are hidden from anonymous visitors. With a password sign-in you see them, as musicbrainz.org shows them to logged-in people.

**Your Gravatar key** is the one thing the server stores. After a password sign-in it keeps the Gravatar key for your email (a SHA-256 hash, not the email) so others see your Gravatar on your profile ([`src/lib/server/avatar-store.ts`](src/lib/server/avatar-store.ts)). `/api/avatar/<username>` redirects to the picture on Gravatar, so no images pass through Undertone. Turning off "Show my picture to others" in Account settings deletes the key.

**The server also caches** public MusicBrainz profile pages for up to a day, to stay within MusicBrainz's rate limits.

## Deploy on Vercel

1. Import the repository in Vercel. The defaults are right: Next.js, `npm run build`.
2. Add a database for the Gravatar keys: in the project's **Storage** tab, add **Upstash for Redis** from the
   Marketplace (the free plan is plenty) and connect it to the project. Vercel then sets
   `KV_REST_API_URL` and `KV_REST_API_TOKEN`, which Undertone picks up on its own.
3. Set `NEXT_PUBLIC_SITE_URL` to your address, then deploy.

[`vercel.json`](vercel.json) runs the server functions in Frankfurt (`fra1`), next to MetaBrainz's servers, which
keeps password sign-in fast. The sign-in route may run for up to two minutes, because listenbrainz.org is slow to
finish its own sign-in; this fits every Vercel plan with Fluid compute (on by default for new projects).

Without the database Undertone still works on Vercel, but shared profile pictures are forgotten whenever a
function restarts.

## Run it yourself

Requirements: Node.js 20 or newer.

```sh
npm install
npm run build
npm start                  # http://localhost:3000
```

On your own machine or server the Gravatar keys are kept in `.data/avatars.json` unless you set the Upstash
variables below.

Optional environment variables:

| Variable | What it does |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Your public address, so shared profile links preview correctly. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | The Upstash Redis database for Gravatar keys (set by Vercel's Upstash integration). `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` work too. |
| `UNDERTONE_DATA_DIR` | Without a database: the folder for `avatars.json` (default `.data`). |
| `NEXT_PUBLIC_YOUTUBE_API_KEY` | A fallback YouTube key. Password sign-ins use ListenBrainz's own. |
| `NEXT_PUBLIC_LB_API_URL`, `NEXT_PUBLIC_LB_WEB_URL` | Point at a self-hosted ListenBrainz. |
| `LB_SESSION_DEBUG` | `1` logs each request a password sign-in makes (method, host and path only). |

## Tests

```sh
node scripts/qa/session.mjs       # password sign-in, against a simulated metabrainz.org and listenbrainz.org
node scripts/qa/avatar-store.mjs  # Gravatar keys, with a simulated Upstash Redis and with the file fallback
node scripts/qa/features.mjs      # every feature in a real browser, with all writes intercepted
node scripts/qa/sweep.mjs         # every page at six widths, for layout problems
```

The browser tests need a running build on port 3124 and a local Chrome. They cache public API responses on disk, so repeated runs don't load MetaBrainz's servers.

## Credits

- All data is from [ListenBrainz](https://listenbrainz.org), [MusicBrainz](https://musicbrainz.org) and the [Cover Art Archive](https://coverartarchive.org), projects of the [MetaBrainz Foundation](https://metabrainz.org). ListenBrainz data is [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
- The API client (`src/lib/api.ts`), data types (`src/lib/lb-types.d.ts`, `src/lib/enums.ts`) and flair styles (`src/styles/flairs.css`) are adapted from [listenbrainz-server](https://github.com/metabrainz/listenbrainz-server).
- The interface is built with [HeroUI](https://heroui.com) and [Next.js](https://nextjs.org).

## License

This project is licensed under the GNU General Public License v2.0, the same as ListenBrainz, because it includes code adapted from it. See the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>© 2026 <a href="https://foxgirls.org">foxgirls.org</a> &nbsp;·&nbsp; GPL-2.0 License</sub>
</div>
