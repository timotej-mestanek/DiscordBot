# Spotify Twitch Extension panel

Statický Twitch Extension panel, který přijímá aktuálně přehrávanou skladbu
přes Twitch Extension PubSub a zobrazí její název, interprety a obal alba.
Nepotřebuje build ani Spotify přihlašovací údaje v prohlížeči.

## Jak data putují

1. Next.js server každých 10 sekund načte Spotify přehrávání pomocí uloženého
   Spotify připojení.
2. Backend podepíše krátkodobý Extension JWT a každých 10 sekund pošle aktuální
   snapshot přes Twitch Helix `extensions/pubsub` pro nastavený broadcaster
   kanál. I nově otevřený panel tak dostane aktuální skladbu. Spotify token ani
   Extension secret se do panelu nikdy neposílají.
3. Panel poslouchá `Twitch.ext.listen("broadcast", ...)`, zpracuje JSON a
   zobrazí skladbu. Pokud Spotify nic nepřehrává nebo vrátí prázdný výsledek,
   zobrazí stav „právě nic nepřehrává“.

Publikovaná zpráva má tento tvar:

```json
{
  "type": "spotify",
  "updatedAt": "2026-10-10T12:00:00.000Z",
  "data": {
    "is_playing": true,
    "item": {
      "name": "Název skladby",
      "artists": [{ "name": "Interpret" }],
      "external_urls": {
        "spotify": "https://open.spotify.com/track/..."
      },
      "album": {
        "images": [{ "url": "https://i.scdn.co/image/..." }]
      }
    }
  }
}
```

`data` může být také `null`, případně může obsahovat `is_playing: false` nebo
`item: null`. Panel tyto stavy zpracuje bez chyby.

## Otestování

1. Přihlas se do nasazené aplikace jako admin a otevři
   `https://najtik.stream/api/auth/spotify/start`. Dokonči Spotify autorizaci.
   Pokud používáš jinou produkční doménu, nahraď `najtik.stream` svou doménou.
2. Spusť skladbu na stejném Spotify účtu, který jsi právě autorizoval.
3. Otevři `https://najtik.stream/spotify`. Očekávaná odpověď je JSON s
   `data.is_playing: true` a `data.item.name` odpovídajícím skladbě. Pokud je
   `data` null nebo je `is_playing` false, Twitch Extension zatím nedostává
   hrající skladbu k zobrazení.
4. V Twitch Developer Console otevři testovací/preview zobrazení nahrané
   Extension verze jako broadcaster, jehož číselné Twitch ID je nastavené v
   `TWITCH_EXTENSION_BROADCASTER_ID`. Přidej Extension panel na kanál, pokud
   ještě není přidaný, a otevři jej. Dej serveru až 10 sekund: panel by měl
   ukázat název skladby a interpreta. Změň skladbu a ověř, že se panel
   aktualizuje.
5. Pokud `/spotify` vrací správnou skladbu, ale panel ji neukáže, zkontroluj
   serverové logy a zda je testovaný panel z aktuální nahrané Extension verze.
   Při Docker Compose můžeš zobrazit logy příkazem
   `docker compose logs --since=10m app`. Chyby z Spotify nebo Twitch PubSub se
   logují na serveru; panel samotný nevypisuje úspěšné doručení.

## Nahrání panelu

1. V Twitch Developer Console nahrajte soubory Extension (`panel.html`,
   `panel.css`, `panel.js`) jako asset balíček. Twitch je potom hostuje pro
   Extension; vlastní webový hosting není potřeba. Zachovejte názvy souborů a
   jejich vzájemné umístění. Není potřeba nic kompilovat.
2. V nastavení Extension vyberte nahraný `panel.html` jako panelové zobrazení
   (panel view) a nakonfigurujte Extension pro broadcaster kanál, na kterém
   ji chcete používat.
3. Pokud se nezobrazuje obal alba, povolte v nastavení Content Security Policy
   Extension obrázky z `i.scdn.co`.
4. V backendu nastavte `TWITCH_EXTENSION_ID`,
   `TWITCH_EXTENSION_SECRET_BASE64` (Base64 Extension secret),
   `TWITCH_EXTENSION_BROADCASTER_ID` (číselné Twitch ID vysílatele). Pro
   získání přehrávání musí být také nastavené Spotify OAuth proměnné a Spotify
   účet musí být připojený.
5. Streamer.bot není pro Spotify PubSub potřeba. Po spuštění Next.js serveru
   server automaticky kontroluje Spotify a každých 10 sekund publikuje snapshot
   do Twitch. Pokud chybí konfigurace Twitch Extension, server vypíše chybu do
   logu.

Panel poslouchá broadcasty pro broadcaster kanál, takže Twitch Extension musí
být otevřená na stejném kanálu, pro který backend zprávy publikuje.
