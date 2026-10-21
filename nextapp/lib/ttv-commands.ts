export type TtvCommandRole = "everyone" | "vip" | "mods";

export type TtvCommand = {
  id: string;
  name: string;
  description: string;
  usage?: string;
  roles: TtvCommandRole[];
};

export type TtvCommandGroup = {
  id: string;
  label: string;
  description: string;
  commands: TtvCommand[];
};

export const ttvCommandGroups: TtvCommandGroup[] = [
  {
    id: "game-interactions",
    label: "Herní interakce",
    description: "Kola štěstí a správa herní PUBG sestavy.",
    commands: [
      {
        id: "wheel",
        name: "!wheel",
        description:
          "Roztočí kolo aktuální hry a odečte nastavený počet N4JT Twitch bodů.",
        usage: "!wheel",
        roles: ["everyone"],
      },
      {
        id: "wheelreset",
        name: "!wheelreset",
        description:
          "Vynuluje limit zatočení kola pro právě hranou hru.",
        usage: "!wheelreset",
        roles: ["mods"],
      },
      {
        id: "newplayer",
        name: "!newplayer",
        description:
          "Přidá nebo nahradí hráče v sestavě PUBG. Pozice 1 je hlavní hráč; 2–4 jsou spoluhráči.",
        usage: "!newplayer <1–4> <PUBG přezdívka>",
        roles: ["mods"],
      },
      {
        id: "deleteplayer",
        name: "!deleteplayer",
        description:
          "Odebere spoluhráče ze sestavy PUBG; hlavního hráče odebrat nelze.",
        usage: "!deleteplayer <2–4>",
        roles: ["mods"],
      },
    ],
  },
  {
    id: "gambling",
    label: "Gambling",
    description:
      "V této kategorii zatím nejsou zdokumentované Twitch chat příkazy.",
    commands: [],
  },
  {
    id: "votes",
    label: "Votes",
    description:
      "Sem si může broadcaster přidat hlasování a vlastní vote příkazy.",
    commands: [],
  },
  {
    id: "others",
    label: "Ostatní",
    description: "Body, klipy a moderátorské nástroje.",
    commands: [
      {
        id: "points",
        name: "!points",
        description: "Zobrazí zůstatek Twitch CustomBody uživatele.",
        usage: "!points",
        roles: ["everyone"],
      },
      {
        id: "givepoints",
        name: "!givepoints",
        description:
          "Převede Twitch CustomBody zůstatek od odesílatele jinému uživateli.",
        usage: "!givepoints <uživatel> <počet>",
        roles: ["everyone"],
      },
      {
        id: "addpoints",
        name: "!addpoints",
        description: "Přidá Twitch CustomBody body uživateli.",
        usage: "!addpoints <uživatel> <počet>",
        roles: ["mods"],
      },
      {
        id: "removepoints",
        name: "!removepoints",
        description: "Odebere Twitch CustomBody body uživateli.",
        usage: "!removepoints <uživatel> <počet>",
        roles: ["mods"],
      },
      {
        id: "clip",
        name: "!clip / !klip",
        description: "Vytvoří 30sekundový Twitch klip a pošle odkaz do chatu.",
        usage: "!clip nebo !klip",
        roles: ["everyone"],
      },
      {
        id: "title",
        name: "!title",
        description: "Změní název streamu.",
        usage: "!title <nový název>",
        roles: ["mods"],
      },
      {
        id: "game",
        name: "!game / !category",
        description: "Změní kategorii nebo hru streamu.",
        usage: "!game <název hry nebo kategorie>",
        roles: ["mods"],
      },
      {
        id: "marker",
        name: "!marker",
        description: "Vytvoří marker streamu s volitelným popisem.",
        usage: "!marker [popis]",
        roles: ["mods"],
      },
    ],
  },
];
