# N4JT Twitch currency for Streamer.bot

Import `N4JT-Currency.sb` in Streamer.bot (`Import` → choose the file). It adds
`!points`, `!addpoints`, `!removepoints`, and `!givepoints`, connected to
`https://najtik.stream/api/integrations/streamerbot/currency`.

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

## Wheels of Fortune

Import `N4JT-Wheels.sb` as a separate package. It adds four actions under
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
