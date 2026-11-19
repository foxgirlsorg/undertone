# Undertone — guide for agents writing feature code

Undertone is an alternative web frontend for ListenBrainz (listenbrainz.org). It talks only to the
public API (https://api.listenbrainz.org/1/...), MusicBrainz WS (musicbrainz.org/ws/2, CORS ok) and
Cover Art Archive. Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind v4, **HeroUI v3**.

The reference implementation (the official frontend you are re-implementing) lives at
`D:\slop machine\listenbrainz\listenbrainz-server\frontend\js\src` — read the matching folder for
what a screen shows and does. **Do not copy its look** (Bootstrap); copy its behaviour and data.

## Hard rules

1. **Only create/edit files you were assigned.** Other agents work in parallel. Never edit
   `src/lib/*`, `src/components/ui/*`, `src/components/shell/*`, `src/app/layout.tsx`,
   `src/app/globals.css`, `next.config.ts`, `package.json` unless your brief says so. If you need a
   shared helper, put it in your own folder (e.g. `src/components/stats/…`).
2. Do not install packages. Do not run `next build`, `next dev`, or start servers. A dev server is
   already running on port 3123 (you may `curl http://localhost:3123/<route>` to check a page
   returns 200, but rendering is client-side so curl only proves it compiled).
3. Verify with `npx tsc --noEmit -p .` from the project root
   (`D:\slop machine\listenbrainz\listenbrainz-alt`). Fix every error in **your** files. Ignore
   errors in files you do not own. Also run `npx eslint <your files>` and fix errors.
4. Every page file is a client component: first line `"use client";`. Read route params with
   `useParams()` from `next/navigation`; read query with `useSearchParams()` — **a page that calls
   `useSearchParams()` must wrap its content in `<React.Suspense>`** (export default a tiny wrapper
   that renders `<Suspense fallback={null}><Inner/></Suspense>`).
5. No placeholder/lorem/fake data. Everything renders from the API. Handle loading
   (`<SkeletonRows/>`), empty (`<Empty>` one sentence) and error (`<ErrorNote error onRetry/>`)
   for every block.
6. No emoji, no gradients, no shadows on resting cards, no glow, no icons in tinted circles, no
   uppercase letter-spaced labels, no violet/indigo.

## Design system (true-black-flat)

- Ground `#000`. Cards `bg-card` (#111) radius 20px padding 22px, **no border, no shadow**. Nested
  surfaces `bg-raised` (#2a2a2a). Elevation by lightness only.
- Text: `text-white` primary; `text-ink-2` (#b4b4b4) secondary; `text-ink-3` (#949494) meta.
- The ONE colour: `text-data` / `bg-data` / `var(--data)` = ListenBrainz orange #eb743b. Use it
  **only on data marks** (chart bars/lines, the current/main series, a loved heart, a link hover).
  Never on buttons, tabs or nav.
- Primary action: HeroUI `<Button>` default variant (white pill, black text). Secondary:
  `variant="secondary"`, tertiary/text: `variant="tertiary"` or `"ghost"`. Destructive:
  `variant="danger-soft"`. One primary per screen.
- Type: Inter. h1 20px/600 (use `<Page title=…>`). Section/card titles 16px/500. Body 14px.
  Meta 12-13px. KPI values 24px/500. Nothing over 32px. Sentence case everywhere.
- Every number: add class `num` (tabular figures); numeric columns right-aligned.
- Grid: content column max 1152px (already set by the layout). One gap: **14px** (`gap-[14px]`)
  both directions. Use CSS grid with spans that land on the same lines: e.g.
  `grid gap-[14px] lg:grid-cols-6` with children `lg:col-span-4` + `lg:col-span-2`, or `col-span-3`
  + `col-span-3`. Cards in one row should end at the same height (balance content / cap lists at
  the same count) — use `items-start` if they cannot balance.
- Phone (≤640px): everything stacks full width, 16px margins (layout handles), touch targets ≥44px.
- Lists: rows on a 64px pitch with 48px covers (that is `ListenCard`). Cap overview lists at 5-10
  rows with a "View all" link in the panel's `aside`. Full list screens paginate with
  "Newer / Older" or "Load more", and state the range ("1–25 of 1,284").
- Charts: hand-written SVG (no chart library). One series, one hue (`var(--data)`), straight 2px
  lines, square bars (≤2px top radius), 3-5 faint horizontal gridlines `#2b2b2b`, round y ticks at
  12px `#949494`, no y-axis line, no legend for a single series, 4-8 flat x labels, a plain
  tooltip (`<title>` element is fine). Size to the question (160-260px tall).

## Building blocks you must use (read the files)

- `src/components/ui/index.tsx`: `Page`, `Panel`, `Link`, `CoverArt`, `UserAvatar`, `UserLink`,
  `Kpi`/`KpiStrip`, `Pill`, `Empty`, `ErrorNote`, `SkeletonRows`, `Loading`, `RangeTabs`,
  `NavTabs`, `SignInPrompt`, `cx`.
- `src/components/listen/listen-card.tsx`: `ListenCard` — render every track/listen with it
  (it already does play, love/hate, queue, pin, recommend, add-to-playlist, delete…).
- `src/lib/feedback.ts`: `useListFeedback(listens)` → `fb.get(listen)` for ListenCard's `feedback`.
- `src/lib/use-lb.ts`: `useLB(key, (api, user) => api.someMethod(...))` — SWR data hook.
  `errorStatus(err)` gives the HTTP status (stats endpoints return 204/404 when not computed yet:
  show an honest "Stats for this period aren't calculated yet" `<Empty>`).
- `src/lib/auth.tsx`: `useAuth()` → `{ api, user, signIn, signOut }`. `user` is `undefined` while
  restoring, `null` when signed out, `{ name, token }` when signed in. Pass `user.token` to API
  methods that need auth.
- `src/lib/api.ts`: the **official ListenBrainz APIService** (107 methods; read the signatures you
  need with grep). For endpoints it lacks, `fetch(\`${api.APIBaseURI}/...\`)` directly with
  `Authorization: Token ${user.token}` when needed. Full server endpoint list: see bottom.
- `src/lib/listen.ts`: `getTrackName`, `getArtistName`, `getRecordingMBID`, `getReleaseMBID`,
  `getReleaseGroupMBID`, `getCoverArt(listen)`, `releaseCover(mbid)`, `releaseGroupCover(mbid)`,
  `caaCover(caaReleaseMbid, caaId)`, `jspfTrackToListen(track)`, `listenKey(l, i)`.
- `src/lib/format.ts`: `fmtInt`, `fmtCompact`, `fmtWhen`, `fmtDate`, `fmtDateLong`, `fmtDuration`,
  `fmtHours`, `plural`, `STATS_RANGES`.
- `src/components/player/player-context.ts`: `usePlayer()` → `playListen(l, context)`,
  `playQueue(listens, i)`, `addToQueue`, …
- `src/lib/config.ts`: `LB_WEB_URL`, `MB_URL`, `CAA_URL`.
- Global ambient types (no import needed): `Listen`, `JSPFObject`, `JSPFPlaylist`, `JSPFTrack`,
  `UserEntityResponse`, `TimelineEvent`, `PinnedRecording`, `ListenFeedBack`,
  `UserStatsAPIRange`, … in `src/lib/lb-types.d.ts`.
- Icons: `@gravity-ui/icons` (outline, 16px, grey). Check an export exists with
  `grep -o "export { default as NAME }" node_modules/@gravity-ui/icons/index.d.ts` or
  `ls node_modules/@gravity-ui/icons/esm | grep -i name`.

## HeroUI v3 (NOT v2 — the API changed)

Docs for each component are in `docs/heroui/<component>.md` (button, card, tabs, modal, table,
select, text-field, input, search-field, toast, dropdown, chip, avatar, switch, skeleton, spinner,
tooltip, popover, alert-dialog, pagination, link, label, description, text-area, number-field,
slider, combo-box, autocomplete, disclosure, accordion, toggle-button-group, radio-group, checkbox,
meter, progress-bar, separator, alert). **Read the doc before using a component.** Key facts:

- Import from `@heroui/react`. No provider needed. Compound components: `Modal.Backdrop`,
  `Modal.Container`, `Modal.Dialog`, `Modal.Header`, `Modal.Heading`, `Modal.Body`,
  `Modal.Footer`, `Modal.CloseTrigger`; `Dropdown.Popover` > `Dropdown.Menu onAction` >
  `Dropdown.Item id textValue` > `<Label>`; `Tabs.ListContainer` > `Tabs.List` > `Tabs.Tab id`
  (+`<Tabs.Indicator/>` inside) and `Tabs.Panel id`.
- Events use React Aria names: `onPress` (not onClick) on Button; `isDisabled`, `isIconOnly`,
  `isRequired`, `isInvalid`. `TextField` takes `value` / `onChange(value: string)` and wraps
  `<Label>`, `<Input>`, `<Description>`, `<FieldError>`.
- Controlled modal: `<Modal.Backdrop isOpen={open} onOpenChange={setOpen}>…</Modal.Backdrop>`
  (no `<Modal>` wrapper needed when controlled). Close button inside: `<Button slot="close">`.
- Toasts: `import { toast } from "@heroui/react"`; `toast("Saved")`, `toast.success("…")`,
  `toast.danger("…", { description })`. The provider is already mounted.
- Select: `<Select selectedKey onSelectionChange>` > `<Label>` + `<Select.Trigger><Select.Value/><Select.Indicator/></Select.Trigger>` + `<Select.Popover><ListBox><ListBox.Item id textValue>…</ListBox.Item></ListBox></Select.Popover>` — check `docs/heroui/select.md`.
- Switch / Checkbox / RadioGroup: see their docs (`isSelected`, `onChange`).
- When unsure, check the type: `node_modules/@heroui/react/dist/components/<name>/*.d.ts`.

## Next.js 16 notes

- `next/link` `<Link href>`; `useRouter().push()`; `useParams<{ username: string }>()`.
- Dynamic segments: folder `[username]`. Decode with `decodeURIComponent`.
- Set the browser title with `<title>` inside the page JSX is NOT allowed in client pages — skip
  titles or use `document.title = …` in an effect.
- `params` passed as props to page components are Promises in Next 16 — **don't use props**, use
  `useParams()` in a client page.

## Server API (all under /1) — public endpoints

```
GET  /search/users/?search_term=        POST /submit-listens            GET /validate-token
GET  /user/{u}/listens?min_ts&max_ts&count   GET /user/{u}/listen-count   GET /user/{u}/playing-now
POST /delete-listen                      GET /user/{u}/similar-users    GET /user/{u}/similar-to/{other}
GET  /latest-import  POST /latest-import GET /user/{u}/services
GET  /user/{u}/playlists  /playlists/createdfor  /playlists/collaborator  /playlists/recommendations  /playlists/search
GET  /lb-radio/tags  GET /lb-radio/artist/{mbid}   GET /explore/lb-radio?prompt=&mode=
GET  /explore/fresh-releases/   GET /user/{u}/fresh_releases   GET /explore/color/{hex}
GET  /art/grid-stats/{u}/{range}/{dim}/{layout}/{size}  GET /art/{custom_name}/{u}/{range}/{size}  POST /art/grid/
GET  /art/year-in-music/{year}/{u}   POST /art/playlist/{mbid}/{dim}/{layout}
GET  /user/{u}/do-not-recommend  POST /do-not-recommend/add|remove
GET  /donors/recent /donors/biggest /donors/all-flairs
POST /export/  GET /export/{id}  GET /export/list  GET /export/{id}/download  POST /export/{id}/delete
POST /feedback/recording-feedback  GET /feedback/user/{u}/get-feedback?score=&count=&offset=
GET  /feedback/recording/{mbid}/get-feedback-mbid   POST|GET /feedback/user/{u}/get-feedback-for-recordings  POST /feedback/import
GET  /metadata/recording/?recording_mbids=&inc=  GET /metadata/release_group/  GET /metadata/lookup/?artist_name=&recording_name=
POST /metadata/submit_manual_mapping/  GET /metadata/get_manual_mapping/  GET /metadata/artist/?artist_mbids=&inc=
POST /pin  /pin/unpin  /pin/delete/{id}  /pin/update/{id}  GET /pin/{id}  GET /{u}/pins  /{u}/pins/following  /{u}/pins/current
POST /playlist/create  GET /playlist/search?query=  POST /playlist/edit/{mbid}  GET /playlist/{mbid}  GET /playlist/{mbid}/xspf
POST /playlist/{mbid}/item/add[/{offset}]  /item/move  /item/delete  POST /playlist/{mbid}/delete  /copy
GET  /popularity/top-recordings-for-artist/{mbid}  /top-release-groups-for-artist/{mbid}  POST /popularity/recording|artist|release|release-group
GET  /cf/recommendation/user/{u}/recording
POST /recommendation/feedback/submit|delete  GET /recommendation/feedback/user/{u}[/recordings]
GET  /user/{u}/followers  /following   POST /user/{u}/follow  /unfollow
GET  /stats/user/{u}/artists|releases|release-groups|recordings|listening-activity|artist-activity|era-activity|genre-activity|artist-evolution-activity|daily-activity|artist-map?range=
GET  /stats/artist/{mbid}/listeners  /stats/release-group/{mbid}/listeners
GET  /stats/sitewide/artists|releases|release-groups|recordings|listening-activity|artist-activity|era-activity|artist-evolution-activity|artist-map
GET  /stats/user/{u}/year-in-music[/{year}]
GET  /status/get-dump-info  /status/service-status  /status/playlist-status
POST /settings/flair  /settings/timezone  /settings/troi  /settings/brainzplayer
POST /user/{u}/timeline-event/create/recording|notification|review|recommend-personal|thanks
GET  /user/{u}/feed/events  /feed/events/{id}  /feed/events/listens/following  /feed/events/listens/similar
POST /user/{u}/feed/events/delete|hide|unhide
GET  /internet_archive/search?artist=&track=&album=
POST /import-listens/ (multipart)  GET /import-listens/list  GET /import-listens/{id}  POST /import-listens/cancel/{id}
GET  /missing/musicbrainz/user/{u}
```

To see exactly what a server endpoint accepts/returns, read its view in
`D:\slop machine\listenbrainz\listenbrainz-server\listenbrainz\webserver\views\*_api.py`
(the docstrings document the response JSON). If a feature needs the website's session (OAuth to
Spotify/Apple/SoundCloud, deleting the account), link out to `${LB_WEB_URL}/…` instead.

## When you finish

Reply with: the routes/files you created, what works, and anything you could not do (with why).
Keep it short.
