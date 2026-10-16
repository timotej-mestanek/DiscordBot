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

Copy the new integration settings from `.env.example` into `.env` and configure:

- `APP_URL` as the public site origin (defaults to `https://najtik.stream` in the production container). Set it to your site's origin if your domain differs; for local development use `http://localhost:3000` (or `http://localhost:3001` through Docker Compose). This must be the browser-facing site URL, never the container bind address `0.0.0.0`.
- Set `DISCORD_LOGIN_REDIRECT_URI`, `TWITCH_LOGIN_REDIRECT_URI`, `DISCORD_OAUTH_REDIRECT_URI`, `TWITCH_LINK_REDIRECT_URI`, and `SPOTIFY_REDIRECT_URI` to callback URLs on that public domain and register the exact values with each provider. Use localhost callback URLs only for local development.
- `INITIAL_ADMIN_TWITCH_LOGIN` (lowercase Twitch login) or `INITIAL_ADMIN_TWITCH_ID` to grant the first admin role when that Twitch account logs in.
- `STREAMERBOT_INGEST_TOKEN` with a long random secret. Streamer.bot must call `POST /api/integrations/streamerbot/points` over HTTPS with `Authorization: Bearer <token>` and JSON such as `{"eventId":"unique-event-id","twitchUserId":"123456","delta":25}`. Use a unique event ID for each change; retries are idempotent, and a delta cannot make the balance negative.
- Streamer.bot can send aggregate chat counts to `POST /api/integrations/streamerbot/chat-metrics` with the same bearer token and JSON `{"eventId":"unique-id","platform":"twitch","userId":"123456","displayName":"viewer","profanityCount":1,"messageCount":1}`. Send counts only (not raw chat messages); use a unique event ID so retries do not double-count.
- Send each gambling event to `POST /api/integrations/streamerbot/gambling` with `{"eventId":"unique-id","platform":"twitch","userId":"123456","displayName":"viewer","activity":"roulette","amount":100}`. `amount` is the amount wagered in that platform's point currency. Twitch and Discord totals are ranked separately and event IDs are idempotent.
- Twitch Extension PubSub requires `TWITCH_EXTENSION_ID`, the base64 Extension secret in `TWITCH_EXTENSION_SECRET_BASE64`, and the broadcaster's numeric `TWITCH_EXTENSION_BROADCASTER_ID`. The authenticated `POST /api/integrations/streamerbot/extensions/pubsub` endpoint publishes current snapshots to the Extension's `broadcast` target. Send one of `{"type":"leaderboards"}`, `{"type":"cs2"}`, `{"type":"pubg","player":"<nickname>"}`, or `{"type":"spotify"}`. Schedule calls or trigger them from Streamer.bot when relevant data changes. The Extension frontend should subscribe with `Twitch.ext.listen("broadcast", callback)` and parse the message JSON; each message has `type`, `updatedAt`, and `data`.
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_REDIRECT_URI`. Register the exact redirect URI in the Spotify application settings.
- `NEXT_PUBLIC_DISCORD_URL` and `NEXT_PUBLIC_INSTAGRAM_URL` for the hero links.

The public Twitch Channel Points balance is not available through the supported Twitch API. Twitch CustomBody is the tracked Twitch currency; only Discord points and Twitch CustomBody can be converted. Admin conversion rates are configured in the dashboard.

The public home page checks the broadcaster's current live status through the Twitch Helix API (`TWITCH_BROADCASTER_LOGIN`) and refreshes it while open; Spotify playback and its overlay stay hidden when Twitch reports the channel offline. Upcoming stream times are managed in Dashboard → Admin. Admins manage all shop entries through one shared editor on `/shop`; each entry can be configured to be used immediately when purchased or added to the account inventory for later use. Shop purchases, uses, and configuration changes are recorded in the admin log and can be reverted there. LED editor access uses inventory purchases; keyframes snap to the 120 frames in a two-second timeline (1/60-second intervals). Effects are stored for future LED integration; physical lights are not connected yet. The editor is locked without an unspent shop purchase. Public point, chat profanity, gambling, and event-statistic rankings are available at `/leaderboards`.

## Wheel of Fortune

Dashboard → Admin → **Kolesá šťastia** configures the main subscription/donation wheel, its VIP follow-up wheel, and any number of game-specific wheels. Add game profiles by the Twitch Game ID; while spinning, the app chooses the profile matching the current live Twitch category. Each profile supports a title, enabled state, 3–30 second animation, 2–24 outcomes, an outcome color, and a positive integer weight. Game profiles also set a spin cap from 1 to 100 (default 2), shared across all viewers. Once reached, the cap must be reset by an admin in the dashboard or by a Twitch moderator/broadcaster using the Streamer.bot reset action. The server chooses the outcome using those weights. One outcome on the main wheel can be marked to trigger the VIP wheel.

Add `https://<your-domain>/overlays/wheel` as an OBS Browser Source. Keep it open during the stream; it polls for new spins and animates each wheel result in order.
The wheel itself shows each configured outcome as text on its colored segment
and has a transparent background for OBS. Add
`https://<your-domain>/overlays/wheel-history` as a second Browser Source to
show a card for each result since its game's latest reset. Cards stay visible
across game changes until that game's spin history is reset; newly completed
spins are added to the list.

Streamer.bot calls `POST /api/integrations/streamerbot/wheels/spin` with the configured `STREAMERBOT_INGEST_TOKEN` as a Bearer token. Use unique source event IDs; duplicate deliveries return the original spin and never charge N4JT points twice.

- Subscription or donation: `{"eventId":"<unique-event-id>","wheel":"main","source":"subscription","userId":"123456","displayName":"viewer"}`. Set `source` to `donation` for a donation event. Each event starts exactly one main-wheel spin.
- N4JT game-wheel points: `{"eventId":"<unique-redemption-or-command-id>","wheel":"game","source":"n4jt_points","userId":"123456","displayName":"viewer"}`. The active game's configured `pointCost` is deducted atomically from that Twitch user's N4JT CustomBody balance; the spin is rejected without a balance change if the user cannot pay.
- Twitch Channel Points: `{"eventId":"<redemption-id>","wheel":"game","source":"channel_points","rewardId":"<configured-reward-id>","userId":"123456","displayName":"viewer"}`. Configure a dedicated Twitch reward and select the same reward ID in the game's Admin profile. Twitch charges the redemption itself. The displayed cost in Admin is a reminder and must match the price set on Twitch; the app cannot set or refund Twitch Channel Points.

The endpoint returns the selected sequence (including the VIP result, when triggered) and records requests in Dashboard → Admin → **Streamer.bot API log**. It returns a conflict if the stream is offline, the active category has no enabled game profile, or the requested wheel is disabled; it returns `429` when the game spin cap has been reached. Imported spin actions announce the result or API rejection in Twitch chat and suppress duplicate-event announcements. See [the Streamer.bot setup guide](../streamerbot_plugin/README.md) for action setup and request examples.

## Streamer.bot Twitch currency commands

Import the ready-to-use Streamer.bot action pack from `../streamerbot_plugin/N4JT-Currency.sb`. It creates `!points`, `!addpoints`, `!removepoints`, and `!givepoints` using the app's Twitch CustomBody balance. Follow the one-time token setup and import instructions in `../streamerbot_plugin/README.md`. The app resolves Twitch logins to user IDs using its Twitch app credentials. Disable CurrencyCore's commands/actions after importing to prevent duplicate changes.

Admins can inspect successful and failed requests to the Streamer.bot currency endpoint in Dashboard → Admin → Streamer.bot API log. Logs are stored in the app database and can be paged through from newest to oldest; authorization tokens are never stored.

## Game overlays

Admins can create game overlay URLs from Dashboard → Overlaye. Add them to OBS as a Browser Source; the animated card is positioned at the lower edge of the stream. CS2 uses the existing Game State Integration endpoint. PUBG uses the official PUBG API for Steam accounts; configure `PUBG_API_KEY` in `.env` or the deployment environment, then set the player's nickname in the admin overlay URL builder. PUBG stats include only ranked matches started today in the Europe/Prague timezone and available in the player's recent match list. The daily result is cached for five minutes to stay within API limits.

Public game overlay endpoints are `GET /api/csdata` and `GET /api/overlays/pubg?player=<nickname>`. Do not put the PUBG API key in a `NEXT_PUBLIC_` variable or in an overlay URL.

Prisma Client is generated before development and production builds. Apply schema changes to the configured database with `pnpm exec prisma migrate deploy`.

For Spotify development, open the site at `http://127.0.0.1:3000` and keep using that host so OAuth/session cookies match the registered redirect URI. Do not mix it with `localhost`; browsers keep separate cookies for each host.

When an already-linked Discord or Twitch identity belongs to a separate web account, linking it while signed in merges the accounts into the signed-in account. Sessions and identity links are retained, balances remain attached to their provider IDs, and admin/audit history is preserved. A merge is refused when both accounts already have different identities from the same provider.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
