This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## N4JT portal setup

### Local development environment

`pnpm dev` loads `.env` and then overrides it with `nextapp/.env.dev`; variables
already provided by the shell take precedence. The checked-in development file
points the app and OAuth callbacks to `http://localhost:3000`, uses the local
Postgres service, and enables wheel test mode. Register the localhost callback
URLs with the relevant OAuth providers before testing login flows.

Start the local database from the repository root with
`docker compose -f docker-compose.db.yml up -d`, then start the web app from
`nextapp` with `pnpm dev`. Production `pnpm build` and `pnpm start` continue to
use the normal `.env` and deployment environment.

Copy the new integration settings from `.env.example` into `.env` and configure:

- `APP_URL` as the public site origin (defaults to `https://najtik.stream` in the production container). Set it to your site's origin if your domain differs; for local development use `http://localhost:3000` (or `http://localhost:3001` through Docker Compose). This must be the browser-facing site URL, never the container bind address `0.0.0.0`.
- Set `DISCORD_LOGIN_REDIRECT_URI`, `TWITCH_LOGIN_REDIRECT_URI`, `DISCORD_OAUTH_REDIRECT_URI`, `TWITCH_LINK_REDIRECT_URI`, and `SPOTIFY_REDIRECT_URI` to callback URLs on that public domain and register the exact values with each provider. Use localhost callback URLs only for local development.
- `INITIAL_ADMIN_TWITCH_LOGIN` (lowercase Twitch login) or `INITIAL_ADMIN_TWITCH_ID` to grant the first admin role when that Twitch account logs in.
- `STREAMERBOT_INGEST_TOKEN` with a long random secret. Streamer.bot must call `POST /api/integrations/streamerbot/points` over HTTPS with `Authorization: Bearer <token>` and JSON such as `{"eventId":"unique-event-id","twitchUserId":"123456","delta":25}`. Use a unique event ID for each change; retries are idempotent, and a delta cannot make the balance negative.
- Streamer.bot can send aggregate chat counts to `POST /api/integrations/streamerbot/chat-metrics` with the same bearer token and JSON `{"eventId":"unique-id","platform":"twitch","userId":"123456","displayName":"viewer","profanityCount":1,"messageCount":1}`. Send counts only (not raw chat messages); use a unique event ID so retries do not double-count.
- Send each gambling event to `POST /api/integrations/streamerbot/gambling` with `{"eventId":"unique-id","platform":"twitch","userId":"123456","displayName":"viewer","activity":"roulette","amount":100}`. `amount` is the amount wagered in that platform's point currency. Twitch and Discord totals are ranked separately and event IDs are idempotent.
- Twitch Extension PubSub uses separate credentials for the two Extensions: set `TWITCH_SPOTIFY_EXTENSION_ID` and `TWITCH_SPOTIFY_EXTENSION_SECRET_BASE64` from the Spotify Extension, and `TWITCH_GAMESTATS_EXTENSION_ID` and `TWITCH_GAMESTATS_EXTENSION_SECRET_BASE64` from the Game Stats Extension. `TWITCH_EXTENSION_BROADCASTER_ID` is the broadcaster's numeric Twitch ID and is shared. The authenticated `POST /api/integrations/streamerbot/extensions/pubsub` endpoint publishes leaderboards and PUBG snapshots to the Game Stats Extension's `broadcast` target when called by Streamer.bot. The app also publishes a `gamestats` snapshot to Game Stats Extension immediately at startup and every two minutes. For testing, Game Stats always marks its own panel live and defaults to PUBG when Twitch has no current game, so PUBG roster stats are still fetched while the channel is offline. Spotify independently reports the actual Twitch live state and shows its offline panel; Spotify only fetches playback and publishes while the channel is live. PUBG statistics are supported; CS2 GSI is deliberately not used, and CS2 stats await the planned FACEIT/API source. No Streamer.bot action is needed for Spotify. Each panel subscribes with `Twitch.ext.listen("broadcast", callback)` and parses its message JSON.
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_REDIRECT_URI`. Register the exact redirect URI in the Spotify application settings.
- `NEXT_PUBLIC_DISCORD_URL` and `NEXT_PUBLIC_INSTAGRAM_URL` for the hero links.
- Shop product images use one Cloudflare R2 bucket, under the `shop-icons/`
  prefix. Create an R2 API token scoped to that bucket with object read, write,
  and delete access, then set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`. Set `R2_PUBLIC_BASE_URL` to the
  HTTPS custom domain connected to that bucket (or its `r2.dev` URL for
  temporary testing). Uploads accept PNG, JPEG, and WebP files up to 2 MB.
  Keep the access key and secret only in the server `.env`; do not use
  `NEXT_PUBLIC_` variables for credentials. The same bucket can later use
  separate prefixes for emoticons or textures.
- `WHEEL_MODE` selects wheel behavior: use `production` for live Twitch game
  selection and point deductions, or `test` to spin game wheels without a live
  stream or charging N4JT points. Test mode is intended for a separate
  development/staging database; game-wheel requests must include the profile's
  Twitch `gameId`.

The public Twitch Channel Points balance is not available through the supported Twitch API. Twitch CustomBody is the tracked Twitch currency; only Discord points and Twitch CustomBody can be converted. Admin conversion rates are configured in the dashboard.

The public home page checks the broadcaster's current live status through the Twitch Helix API (`TWITCH_BROADCASTER_LOGIN`) and refreshes it while open; Spotify playback and its overlay stay hidden when Twitch reports the channel offline. Upcoming stream times are managed in Dashboard → Admin. Admins manage all shop entries through one shared editor on `/shop`; each entry can be configured to be used immediately when purchased or added to the account inventory for later use. Shop purchases, uses, and configuration changes are recorded in the admin log and can be reverted there. LED editor access uses inventory purchases; keyframes snap to 60 fps and the effect is included in the same queued shop event as any other redemption. Its configured Streamer.bot action decides how to apply the effect (for example, forward it to a device). Public point, chat profanity, gambling, and event-statistic rankings are available at `/leaderboards`.

### Shop actions in Streamer.bot

Each shop product has a **Streamer.bot action** containing the exact name of a
Streamer.bot action. Buying an immediate-use product queues that action;
buying an inventory product only adds it to inventory, and using **Redeem from
inventory** queues the action later. Shop events are saved in PostgreSQL in the
same transaction as the point deduction or inventory decrement, then delivered
over one authenticated outbound WebSocket at
`wss://<your-domain>/api/integrations/streamerbot/shop/live`. If Streamer.bot is
offline, events remain queued and are retried after reconnect. The dashboard's
Shop administration section shows attempts, errors, and acknowledgements.

To receive the events, configure the persistent `n4jtStreamerBotToken` global
with the same value as `STREAMERBOT_INGEST_TOKEN`. Add
`../streamerbot_plugin/N4JT-WSSClient.cs` as one long-running C# action and
start that client when Streamer.bot starts. It reconnects automatically. The
product's configured action name selects which Streamer.bot action receives the
event; no chat command is involved. Change the client's `Endpoint` constant if
the site uses a different domain. The selected action receives `shopEventId`,
`shopEventType`, `shopActionKey`, `shopEventJson`, `shopEffectJson`,
`shopProductId`, `shopProductName`, `shopRedemptionId`, `shopAccountId`, buyer
identity fields, and payment fields (payment is `null` for later inventory
redemption). `shopEffectJson` contains the event's effect payload: for a custom
LED editor redemption it is the full timeline; for a generic shop item it is
the item's name and description. The selected action decides what to do with it.

The WSS client acknowledges an event after it has started the matching action
and stored the event ID in the persistent
`n4jtShopProcessedEventIds` global. Delivery is at-least-once: an interrupted
connection may cause a retry, so custom actions should use `shopEventId` as an
idempotency key. A dashboard **Delivered** status means Streamer.bot accepted
the action, not that a downstream effect completed. Reverting a redemption is
only allowed before its event has started delivery.

## Wheel of Fortune

Dashboard → Admin → **Wheels** configures the main subscription/donation wheel, its VIP follow-up wheel, and any number of game-specific wheels. Add game profiles by Twitch Game ID; while spinning, the app chooses the profile matching the current live Twitch category. Each profile supports a title, enabled state, 3–30 second animation, 2–24 outcomes, an outcome color, and a probability percentage for each outcome. Probabilities are kept at exactly 100% and determine both the server-side draw and the visible wheel sector sizes. Game wheels remove previously selected outcomes until reset and renormalize the remaining probabilities for each spin. Game profiles also set a spin cap from 1 to 100 (default 2), shared across all viewers. Once reached, the cap must be reset by an admin in the dashboard or by a Twitch moderator/broadcaster using the Streamer.bot reset action. One outcome on the main wheel can be marked to trigger the VIP wheel.

Add `https://<your-domain>/overlays/wheel` as an OBS Browser Source. Keep it
open during the stream; it connects to the app's WebSocket and animates new
spins in order.
The wheel itself shows each configured outcome as text on its colored segment
and has a transparent background for OBS. Add
`https://<your-domain>/overlays/wheel-history` as a second Browser Source to
show a card for each result since its game's latest reset. Cards stay visible
across game changes until that game's spin history is reset; newly completed
spins are added to the list.

Both wheel overlays use a direct WebSocket connection to
`/api/overlays/wheels/live` for spin and reset events. The app's custom
`server.mjs` serves both Next.js and the WebSocket endpoint, so production
deployments must run it with `pnpm start` (or the provided Docker image), not
the generic `next start` command. The provided Docker image includes the full
Next.js runtime rather than standalone output because Next.js standalone mode
does not support a custom server. A reconnect receives a history snapshot and
any spins missed while disconnected.

Streamer.bot calls `POST /api/integrations/streamerbot/wheels/spin` with the configured `STREAMERBOT_INGEST_TOKEN` as a Bearer token. Use unique source event IDs; duplicate deliveries return the original spin and never charge N4JT points twice.

- Subscription or donation: `{"eventId":"<unique-event-id>","wheel":"main","source":"subscription","userId":"123456","displayName":"viewer"}`. Set `source` to `donation` for a donation event. Each event starts exactly one main-wheel spin.
- A custom Streamer.bot trigger can spin the main wheel for any viewer with `{"eventId":"<unique-event-id>","wheel":"main","source":"streamerbot","userId":"123456","displayName":"viewer"}`.
- N4JT game-wheel points: `{"eventId":"<unique-redemption-or-command-id>","wheel":"game","source":"n4jt_points","userId":"123456","displayName":"viewer"}`. The active game's configured `pointCost` is deducted atomically from that Twitch user's N4JT CustomBody balance; the spin is rejected without a balance change if the user cannot pay.
- Twitch Channel Points: `{"eventId":"<redemption-id>","wheel":"game","source":"channel_points","rewardId":"<configured-reward-id>","userId":"123456","displayName":"viewer"}`. Configure a dedicated Twitch reward and select the same reward ID in the game's Admin profile. Twitch charges the redemption itself. The displayed cost in Admin is a reminder and must match the price set on Twitch; the app cannot set or refund Twitch Channel Points.

The endpoint returns the selected sequence (including the VIP result, when triggered) and records requests in Dashboard → Admin → **Streamer.bot API log**. It returns a conflict if the stream is offline, the active category has no enabled game profile, or the requested wheel is disabled; it returns `429` when the game spin cap has been reached. Imported spin actions announce the result or API rejection in Twitch chat and suppress duplicate-event announcements. See [the Streamer.bot setup guide](../streamerbot_plugin/README.md) for action setup and request examples.

To test without a live stream, set `WHEEL_MODE=test`. Game-wheel requests can
omit both `eventId` and `gameId`, for example
`{"wheel":"game","source":"n4jt_points","userId":"123456","displayName":"Test viewer"}`.
The server generates an event ID and selects the first enabled game profile in
alphabetical order. Include `gameId` to select a particular profile.
The profile must already exist and be enabled. N4JT points are not charged in
this mode. Test spins still count toward the profile's spin cap and unique-item
selection until you reset that game's profile from the admin dashboard. In
test mode, the history overlay lists cards for all configured game profiles.

Any wheel outcome can optionally award Twitch CustomBody points. Set its
**Twitch points** amount in Dashboard → Admin → Wheels; the amount is credited
to the `userId` sent by Streamer.bot and recorded in the point ledger atomically
with the spin. Use outcome labels such as `POINTS` and `EXTRA POINTS` and set
the desired award for each segment.

## Streamer.bot timer and voting overlays

Add `/overlays/timer` and `/overlays/voting` as OBS Browser Sources, or copy
their URLs from Dashboard → Admin → Overlays. Both connect to the app's
WebSocket and reconnect automatically. Streamer.bot authenticates requests
with the existing `STREAMERBOT_INGEST_TOKEN` bearer token:

- Start or replace the countdown with `POST /api/integrations/streamerbot/overlays/timer`
  and `{"eventId":"unique-trigger-id","durationSeconds":90,"title":"BREAK"}`.
  `durationSeconds` must be an integer from 1 to 86400. Reusing a recent timer
  `eventId` is idempotent. When the countdown ends, it hides until another
  timer event arrives.
- Send current voting results with `POST /api/integrations/streamerbot/overlays/voting`
  and `{"eventId":"poll-123","active":true,"question":"Next game?","options":[{"id":"one","label":"Game A","votes":12},{"id":"two","label":"Game B","votes":8}]}`.
  Update the same poll by posting the current counts again. Send
  `{"eventId":"poll-123","active":false,"question":"Next game?","options":[]}`
  when it ends. Nextapp only displays supplied counts; Streamer.bot owns vote
  collection and tallying.
- Show or hide an alert with `POST /api/integrations/streamerbot/overlays/alert`
  and add `/overlays/alert` as an OBS Browser Source. Show an alert with
  `{"eventId":"alert-123","active":true,"severity":"warning","title":"Attention","message":"Stream will end soon."}`.
  Supported severities are `info`, `attention`, `warning`, and `critical`.
  Keep the alert visible until a hide request such as
  `{"eventId":"alert-hide-123","active":false}` is sent. All alert requests use
  the same bearer token; active alerts are included in the WebSocket snapshot
  for newly connected overlays.

## Streamer.bot Twitch currency commands

Import the ready-to-use Streamer.bot action pack from `../streamerbot_plugin/N4JT-Currency.sb`. It creates `!points`, `!addpoints`, `!removepoints`, and `!givepoints` using the app's Twitch CustomBody balance. Follow the one-time token setup and import instructions in `../streamerbot_plugin/README.md`. The app resolves Twitch logins to user IDs using its Twitch app credentials. Disable CurrencyCore's commands/actions after importing to prevent duplicate changes.

Admins can inspect successful and failed requests to the Streamer.bot currency endpoint in Dashboard → Admin → Streamer.bot API log. Logs are stored in the app database and can be paged through from newest to oldest; authorization tokens are never stored.

## Game overlays

Admins can create game overlay URLs from Dashboard → Overlaye. Add them to OBS as a Browser Source; the animated card is positioned at the lower edge of the stream. CS2 uses the existing Game State Integration endpoint. PUBG uses the official PUBG API for Steam accounts; configure `PUBG_API_KEY` in `.env` or the deployment environment, then set the player's nickname in the admin overlay URL builder. PUBG stats include only ranked matches started today in the Europe/Prague timezone and available in the player's recent match list. The daily result is cached for five minutes to stay within API limits.

Public game overlay endpoints are `GET /api/csdata` and `GET /api/overlays/pubg?player=<nickname>`. Do not put the PUBG API key in a `NEXT_PUBLIC_` variable or in an overlay URL.

The Twitch `ttv_gamestats_extension` is currently a PubSub receiver/renderer; it does not fetch game APIs or publish stats. Dashboard → Admin → Game stats saves the PUBG player nickname (default `N4JTIK`) and up to three teammate nicknames in the database for the future stats producer.

Prisma Client is generated before development and production builds. Apply schema changes to the configured database with `pnpm exec prisma migrate deploy`.

For Spotify development, open the site at `http://127.0.0.1:3000` and keep using that host so OAuth/session cookies match the registered redirect URI. Do not mix it with `localhost`; browsers keep separate cookies for each host.

When an already-linked Discord or Twitch identity belongs to a separate web account, linking it while signed in merges the accounts into the signed-in account. Sessions and identity links are retained, balances remain attached to their provider IDs, and admin/audit history is preserved. A merge is refused when both accounts already have different identities from the same provider.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
