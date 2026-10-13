# PUBG Twitch panel

Statický Twitch Extension panel, ktorý počúva `broadcast` správy cez Twitch
Extension PubSub a vykresľuje PUBG štatistiky. Súbory `panel.html`, `panel.css`
a `panel.js` nahrajte na HTTPS hosting a URL `panel.html` nastavte ako URL
panelu v Twitch Developer Console.

Panel očakáva správu v tomto formáte:

```json
{
  "type": "pubg",
  "updatedAt": "2026-10-10T12:00:00.000Z",
  "data": {
    "player": "PUBG nickname",
    "matches": 3,
    "kills": 12,
    "deaths": 2,
    "kd": 6,
    "longestKill": 245.6,
    "headshotRate": 25,
    "mostDamage": 1800,
    "averageDamage": 950
  }
}
```

Repozitár už takúto správu posiela endpointom
`POST /api/integrations/streamerbot/extensions/pubsub`. Zavolajte ho s
autorizáciou Streamer.bot a telom:

```json
{ "type": "pubg", "player": "PUBG nickname" }
```

Endpoint načíta denné ranked štatistiky hráča cez PUBG API a odošle ich do
Twitch Extension PubSub. Extension musí byť nakonfigurovaný pre správny
broadcaster kanál a backend musí mať nastavené `TWITCH_EXTENSION_ID`,
`TWITCH_EXTENSION_SECRET_BASE64`, `TWITCH_EXTENSION_BROADCASTER_ID`,
`PUBG_API_KEY` a autorizáciu integrácie Streamer.bot.
