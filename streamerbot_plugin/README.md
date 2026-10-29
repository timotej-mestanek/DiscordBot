# N4JT Twitch currency for Streamer.bot

Import `N4JT-Currency.sb` in Streamer.bot (`Import` → choose the file). It adds
`!points`, `!addpoints`, `!removepoints`, and `!givepoints`, connected to
`https://najtik.stream/api/integrations/streamerbot/currency`.

## Activity points

Import `N4JT-Activity-Points.sb` in Streamer.bot (`Import` → choose the file).
It creates an activity-points action with a Twitch **Chat Message** trigger
and a repeating **300-second timer**. Each user who sends a message during the
preceding five minutes receives 50 N4JT Twitch CustomBody points at the next
timer tick; subscribers receive 65 points.

Before enabling it, create a persistent string global variable named
`n4jtStreamerBotToken` with the same `STREAMERBOT_INGEST_TOKEN` used by the app.
The imported action uses `N4JT-Activity-Points.cs`; the source is included for
review or editing. It reads Streamer.bot's `userId` and `isSubscribed` chat
arguments, records active users in a persistent global variable, and posts
points to `/api/integrations/streamerbot/points`. Request failures are written
to the Streamer.bot log. For a different app domain, change the `Endpoint`
constant in the source before importing.

## Twitch moderator commands and clips

Import `N4JT-Moderator-Commands.sb` to add these Twitch chat commands:

| Command | Who can use it | Usage |
| --- | --- | --- |
| `!title` | Moderators and broadcaster | `!title <new stream title>` (up to 140 characters) |
| `!game` / `!category` | Moderators and broadcaster | `!game <game or category name>` |
| `!marker` | Moderators and broadcaster | `!marker [optional description]` |
| `!clip` / `!klip` | Everyone | Creates a 30-second Twitch clip and posts its link |

The moderator actions check Streamer.bot's `isModerator` or `isBroadcaster`
arguments before changing stream metadata or creating a marker. The clip action
is intentionally public and has per-user and global chat cooldowns. Twitch must
allow clipping and Streamer.bot must be connected to the broadcaster account
with the required permissions.

The actions use Streamer.bot's built-in Twitch methods, so they do not need the
N4JT API token. If a command name already exists in your Streamer.bot setup,
disable the old trigger before enabling the imported one to avoid duplicate
responses. The individual C# action sources are included alongside the export.

## One-time setup

1. In the app's deployment environment, set `STREAMERBOT_INGEST_TOKEN` to a
   long random secret. The app also needs its existing `TWITCH_CLIENT_ID` and
   `TWITCH_CLIENT_SECRET` so it can resolve Twitch logins to numeric user IDs.
2. In Streamer.bot's **Global Variables** panel, create a **persistent** string
   variable named `n4jtStreamerBotToken`. Set its value to the same ingest
   token. Do not use a command argument or chat response for the token.
3. Disable or remove CurrencyCore's four currency commands/actions so they
   cannot run in parallel with the imported commands.
4. The imported add/remove actions check the Twitch `isModerator` or
   `isBroadcaster` chat argument before changing a balance.

The imported commands use Twitch chat and logins (`!addpoints username 25`),
not raw numeric IDs. The app resolves usernames using Twitch Helix. `!givepoints`
transfers points from the command sender to the named user; it cannot be used
to transfer to yourself or spend more than your balance. All changes use the
app's Twitch CustomBody balance and ledger.

The package contains no secret. The endpoint URL is set to the app's production
domain; if the app is hosted elsewhere, change the `endpoint` constant in each
imported C# sub-action before enabling the commands.

## Local alert UDP actions

Import `N4JT-Alerts.sb` in Streamer.bot. This is separate from **N4JT Wheels**:
it only sends UDP alert messages and does not call the wheel API or start a
wheel.

The package sends UTF-8 messages to `192.168.1.252:4210`:

| Action | Trigger | UDP payload |
| --- | --- | --- |
| `N4JT Alerts - Follow` | Twitch Follow (included) | `FOLLOW` |
| `N4JT Alerts - Subscription` | Twitch Subscription (included) | `SUBSCRIBE` |
| `N4JT Alerts - Donation` | No provider trigger yet; attach one when ready | `DONATE 1`, `DONATE 2`, or `DONATE 3` |

The donation action reads an amount argument named `amount`, `donationAmount`,
`donation`, or `tipAmount`, in EUR. Amounts below 5 send `DONATE 1`; amounts
from 5 to under 20 send `DONATE 2`; 20 or more send `DONATE 3`. The action only
sends the UDP alert; connect it to your donation provider's trigger yourself
when that provider is configured. These alert actions do not add delays, start
wheels, or post chat messages.

## Wheels of Fortune

Import `N4JT-Wheels.sb` as a separate package. It adds five actions under
**N4JT Wheels**; they have no triggers until you connect them, so importing the
pack does not start any wheel. The actions use the same persistent
`n4jtStreamerBotToken` global variable configured above.

Connect the actions to the events you want in Streamer.bot:

| Imported action | Connect it to |
| --- | --- |
| `N4JT Wheels - Main - Subscription` | Your Twitch subscription event |
| `N4JT Wheels - Main - Donation` | Your donation provider's event |
| `N4JT Wheels - Game - N4JT Points` | A Twitch chat command such as `!wheel`; the app charges the active game's configured N4JT Twitch point cost |
| `N4JT Wheels - Game - Twitch Channel Points` | The Twitch reward-redemption event for the dedicated wheel reward |
| `N4JT Wheels - Reset active game limit` | A chat command such as `!wheelreset`; only moderators and the broadcaster can use it |

The action reads Twitch user ID from `userId`, `twitchUserId`, or `user_id`;
display name from `userName`, `displayName`, `user`, or `user_name`; and a
unique event ID from `eventId`, `redemptionId`, `redemption_id`, `msgId`,
`messageId`, or `id`. The Channel Points action also reads the reward ID from
`rewardId`, `reward_id`, `redemptionRewardId`, or `rewardID`. If the trigger
provides different argument names, edit that action's C# sub-action to use the
names shown in its argument list. The action logs missing or failed requests in
Streamer.bot rather than silently spinning with a generated, non-idempotent ID.
The API URL in each action's C# sub-action defaults to
`https://najtik.stream/api/integrations/streamerbot/wheels/spin`; change its
`endpoint` constant if your app uses a different public domain.

In Dashboard → Admin → **Kolesá šťastia**, enable and configure the main wheel,
VIP wheel, and game profiles before attaching triggers. A marked VIP result
automatically adds the VIP spin after the main result. A game profile is chosen
from the current live Twitch category's Game ID. For Twitch Channel Points,
create a dedicated Twitch reward, put its exact reward ID in the game profile,
and set the same point cost on Twitch and in the dashboard. Twitch charges that
redemption itself; N4JT cannot refund Channel Points if a redemption is sent
while the app or overlay is unavailable. N4JT point charges, by contrast, are
atomic with the spin and are not taken if the request fails.

Add `https://najtik.stream/overlays/wheel` as an OBS Browser Source and keep it
open while streaming. For another domain, replace `najtik.stream` with the
public app host. Requests and errors are visible in Dashboard → Admin →
**Streamer.bot API log**.

Each game profile allows up to two spins by default (configurable from 1 to 100)
across all viewers. Once the limit is reached, further game spins are rejected
until an admin uses **Resetovať limit zatočení** in the dashboard or a Twitch
moderator/broadcaster invokes the reset action. To set up the chat command,
create `!wheelreset`, attach its trigger to the imported reset action, and make
sure Streamer.bot provides `isModerator`/`isBroadcaster`, `userId`,
`userName`, and `msgId` in that trigger's arguments. The API checks the
moderator/broadcaster flags again, resets only the current live game's counter,
and records the reset in the audit and Streamer.bot API logs.

The spin actions post the result to Twitch chat after a successful spin, and
post the API's error message if the spin is rejected. An idempotent duplicate
event is not announced a second time. The main wheel message includes the VIP
result too when that spin triggered the VIP wheel.

## N4JT WSS client for shop events

The WSS client keeps one authenticated outbound connection from Streamer.bot to
`wss://najtik.stream/api/integrations/streamerbot/shop/live`. The app queues a
shop event when an immediate-use item is bought or an inventory item is
redeemed, then sends it over this connection. If Streamer.bot is offline, the
event remains queued and is retried after reconnect.

1. Set `STREAMERBOT_INGEST_TOKEN` in the app environment.
2. In Streamer.bot, create the persistent string global
   `n4jtStreamerBotToken` with that same token.
3. Add `N4JT-WSSClient.cs` as a C# action and start it once when Streamer.bot
   starts. The client reconnects automatically; it is not a chat command.
4. In Shop administration, set each product's **Streamer.bot action** to the
   exact name of the Streamer.bot action that should handle that product.

The WSS client dispatches each event to the configured action and makes these
arguments available: `shopEventId`, `shopEventType`, `shopActionKey`,
`shopEventJson`, `shopEffectJson`, `shopProductId`, `shopProductName`,
`shopRedemptionId`, `shopAccountId`, buyer identity, and payment details.
`shopEffectJson` contains the event's effect payload: a custom LED timeline
when using the LED editor, or a basic item description for a generic shop
redemption. The selected action can interpret it and choose what to do, such as
setting colors, spinning a wheel, playing a sound, or communicating with a
device. The app does not open a separate LED socket or prescribe UDP/TCP for
that action.

The WSS client acknowledges an event after it has started the configured
action. Delivery is at-least-once, so use `shopEventId` as an idempotency key
for effects that must not run twice. A dashboard **Delivered** status means
Streamer.bot accepted the action, not that the action's downstream effect
finished.

For persistent cards showing each result since each game's latest reset, add
`https://najtik.stream/overlays/wheel-history` as a second OBS Browser Source.
Newly completed spins are added to the cards until an admin, moderator, or
broadcaster resets that game's wheel limit; cards stay visible across game
changes. The regular `/overlays/wheel` source shows the spinning wheel with
each outcome's text on its colored segment.

## PUBG roster commands

Import `N4JT-Pubg-Roster.sb`. It adds the actions `N4JT PUBG - Add or replace
player` and `N4JT PUBG - Delete player`; importing does not create chat
commands or triggers.

1. Reuse the persistent `n4jtStreamerBotToken` global variable configured
   above. The app must have `STREAMERBOT_INGEST_TOKEN` set to the same value.
2. Create the Twitch chat command `!newplayer` and connect it to **N4JT PUBG -
   Add or replace player**. Create `!deleteplayer` and connect it to **N4JT PUBG
   - Delete player**.
3. Make sure the command trigger supplies `rawInput` (the text following the
   command), `isModerator`, and `isBroadcaster`. Both imported actions reject
   non-moderators and non-broadcasters; the server also requires the bearer
   token.

Positions are one-based: `1` is the main player (initially `N4JTIK`), while
`2` through `4` are teammates. `!newplayer <1-4> <PUBG nickname>` replaces an
existing player or appends at the next position; it will not create gaps. For
example, `!newplayer 2 najt` adds or replaces slot 2. Slot 1 can be renamed
with `!newplayer 1 <nickname>` but cannot be deleted. `!deleteplayer <2-4>`
removes that teammate and shifts later entries down, so deleting slot 2 moves
the previous slot 3 to slot 2. The roster is stored in the app database and
changes are recorded in the admin audit log and Streamer.bot API log.

The package contains no secret. Its endpoint defaults to
`https://najtik.stream/api/integrations/streamerbot/pubg-roster`; change the
`endpoint` constant in both C# sub-actions if the app uses another public host.
