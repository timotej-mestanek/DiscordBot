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
