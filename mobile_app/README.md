# N4JT Stream Deck

Standalone Expo wrapper for the admin-only Nextapp Stream Deck page. The Nextapp
session and existing admin API handle authentication and authorization; no
Streamer.bot token is stored in the mobile app.

## Configure

Set `EXPO_PUBLIC_WEB_URL` to the public HTTPS origin of the Nextapp before
starting Expo. For PowerShell:

```powershell
$env:EXPO_PUBLIC_WEB_URL = "https://najtik.stream"
pnpm install
pnpm start
```

Open the project in Expo Go or build it for Android/iOS. Sign in as an admin
inside the app's web view. For local testing from a phone, use the computer's
LAN address instead of `localhost` and configure OAuth callbacks for that
development setup.

The available Stream Deck action resets the active game's wheel spin limit and
result history. Raffle, voting, and round-result confirmation stay disabled
until Nextapp provides corresponding server actions.
