# Undertone

An independent, unofficial web client for [ListenBrainz](https://listenbrainz.org), the open music listening
history service run by the non-profit [MetaBrainz Foundation](https://metabrainz.org).

Every listen, statistic, playlist and recommendation comes from the
[ListenBrainz API](https://listenbrainz.readthedocs.io/). Music metadata is from
[MusicBrainz](https://musicbrainz.org) and cover art from the [Cover Art Archive](https://coverartarchive.org).
Undertone is not affiliated with or endorsed by the MetaBrainz Foundation. If you use it, please consider
[supporting MetaBrainz](https://metabrainz.org/donate).

## Undertone stores nothing about you

There is no database. The server keeps no passwords, sessions, settings, tokens or listening data, and logs none
of them. You can check every line below.

**Signing in with a token.** Your ListenBrainz token stays in your browser (`localStorage`) and every request goes
straight from your browser to `api.listenbrainz.org`. Undertone's server is not involved.

**Signing in with your username and password.** ListenBrainz only lets its own website read your settings and
email, and browsers don't allow another site to log in there, so this one step goes through Undertone's server
([`src/lib/server/lb-session.ts`](src/lib/server/lb-session.ts)):

1. Your password is sent once to `metabrainz.org/login`, exactly like the MetaBrainz login form does, and then
   forgotten. It is never written anywhere, logged, or sent to any other host.
2. The server follows listenbrainz.org's own "Sign in with MetaBrainz" flow. The metabrainz.org session from
   step 1 is dropped as soon as listenbrainz.org has logged you in.
3. The listenbrainz.org session cookies are handed back to your browser in one `HttpOnly` cookie. The server
   keeps no copy: each later request reads them from that cookie, uses them, and forgets them.
4. Your settings, email and token are read from listenbrainz.org when you open Undertone and held in memory
   until you close the tab. Signing out deletes the cookie and logs you out on listenbrainz.org.

**Settings** are saved to your ListenBrainz account through its API and never kept by Undertone. A few
preferences ListenBrainz has no field for (the volume, "submit listens while playing") last only until you
close the tab.

**The one thing the server caches** is public MusicBrainz profile pages (the avatar, bio and links anyone can see
on musicbrainz.org), for up to a day, to stay within MusicBrainz's rate limits.

## Running it

```sh
npm install
npm run build
npm start
```

Optional environment variables:

| Variable | What it does |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Your public address, so shared profile links preview correctly. |
| `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` | Enables Spotify playback. Create an app at developer.spotify.com and add `<your site>/spotify-callback` as a redirect URI. Needs Spotify Premium. |
| `NEXT_PUBLIC_YOUTUBE_API_KEY` | Enables YouTube search for tracks that have no YouTube link. |
| `NEXT_PUBLIC_LB_API_URL`, `NEXT_PUBLIC_LB_WEB_URL` | Point at a self-hosted ListenBrainz. |

## Tests

```sh
node scripts/qa/session.mjs     # password sign-in, against a simulated metabrainz.org and listenbrainz.org
node scripts/qa/features.mjs    # every feature, in a real browser, with all writes intercepted
node scripts/qa/sweep.mjs       # every page at six widths, for layout problems
```

The browser tests need a running build on port 3124 and a local Chrome. They cache public API responses on
disk so repeated runs don't load MetaBrainz servers.

## License

GPL-2.0, the same as ListenBrainz: `src/lib/api.ts` and `src/lib/lb-types.d.ts` are adapted from
[listenbrainz-server](https://github.com/metabrainz/listenbrainz-server).

© [foxgirls.org](https://foxgirls.org)
