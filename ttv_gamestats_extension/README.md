# Twitch Game Stats Extension

Samostatná Twitch Extension pro zobrazení herních statistik. Panel nic
nenačítá z herních API a neobsahuje seznam hráčů; pouze vykresluje zprávy
doručené přes Twitch Extension PubSub na topic `broadcast`.

Next.js backend posílá snapshot do PubSub při startu a pak každé dvě minuty.
Pro testování vždy nastaví Game Stats panel jako live; pokud Twitch hlásí
offline stav a neposkytne aktuální kategorii, použije PUBG, takže může načíst a
zobrazit herní data i mimo stream. Používá přezdívku hlavního hráče `N4JTIK`
a až tři ručně spravované spoluhráče z Dashboard → Admin; PUBG denní statistiky
se cachují pět minut. Spotify Extension naopak používá skutečný stav streamu a
zobrazuje offline fallback. CS2 GSI se záměrně nepoužívá; CS2 bude podporováno
až po napojení FACEIT/API zdroje. Do té doby se pro CS2 zobrazí fallback „Teď
hraju něco jiného“. Extension samotná žádná herní API nevolá.

## Zpráva pro panel

Každá zpráva má envelope `type`, `updatedAt` a `data`; `updatedAt` je
volitelné:

```json
{
  "type": "gamestats",
  "updatedAt": "2026-10-17T20:00:00.000Z",
  "data": {
    "stream": { "isLive": true },
    "game": { "id": "pubg", "name": "PUBG" },
    "supported": true,
    "players": [
      {
        "id": "main",
        "name": "N4JTIK",
        "role": "self",
        "kd": 2.45,
        "stats": {
          "Kills": 18,
          "Deaths": 7,
          "Ranked zápasy": 5,
          "Headshot rate": "27 %"
        }
      },
      {
        "id": "teammate-1",
        "name": "Teammate",
        "role": "teammate",
        "kd": 1.8,
        "stats": {
          "Kills": 12,
          "Deaths": 8,
          "Ranked zápasy": 5
        }
      }
    ]
  }
}
```

- `stream.isLive: false`: zobrazí fallback pro offline stream.
- `stream.isLive: true` a `supported: false`: zobrazí název právě hrané,
  nepodporované hry a fallback.
- `supported: true`: vykreslí hráče. `players[0]` je hlavní hráč; další hráče
  lze přepínat šipkami dole.
- `kd` je společná hlavní statistika. Všechny game-specific hodnoty patří do
  `stats` jako čísla nebo text; jejich klíče se zobrazí jako popisky.
- Prázdné nebo nevalidní `players` zobrazí stav, že statistiky zatím nejsou
  dostupné.

Například pro CS2 může backend poslat K/D a do `stats` přidat kills, deaths,
assists, FACEIT ELO nebo jiné herní údaje, aniž by se měnil panel.

## Broadcaster configuration and new viewers

Nahrajte také `config.html`, `config.css` a `config.js` a nastavte
`config.html` jako broadcaster configuration view. Broadcaster zde může uložit
obálku zprávy `type: "gamestats"`; Twitch uloží snapshot pro kanál a doručí ho
panelu při každém otevření rozšíření divákem. Uložená konfigurace má limit 5 KB.

Panel zobrazí uložený snapshot okamžitě a poté ho nahradí nejnovější živou
zprávou `broadcast` z PubSub. Uložení konfigurace nijak nemění ani nevypíná
publisher backendu.

## Nahrání do Twitch

Nahrajte `panel.html`, `panel.css` a `panel.js` jako assety Extension v Twitch
Developer Console a nastavte `panel.html` jako panel view. Nastavte také
`config.html` jako broadcaster configuration view. Twitch soubory hostuje;
samostatný webhosting ani build nejsou potřeba. Panel vyplní celou plochu svého
iframe, jejíž skutečnou velikost určuje Twitch.

> Backend publikuje zprávu `type: "gamestats"` jen tehdy, když jsou nastavené
> Game Stats Extension ID a secret. PubSub zpráva se posílá hned po startu
> aplikace a potom každé dvě minuty.
