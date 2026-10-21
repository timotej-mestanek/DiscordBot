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
    label: "Game interactions",
    description: "Wheel spins and PUBG roster management.",
    commands: [
      {
        id: "wheel",
        name: "!wheel",
        description:
          "Spin the wheel for the current game. The configured number of N4JT Twitch points will be charged.",
        usage: "!wheel",
        roles: ["everyone"],
      },
      {
        id: "wheelreset",
        name: "!wheelreset",
        description:
          "Reset the spin limit for the currently active game's wheel.",
        usage: "!wheelreset",
        roles: ["mods"],
      },
      {
        id: "newplayer",
        name: "!newplayer",
        description:
          "Add or replace a player in the PUBG roster. Slot 1 is the main player; slots 2–4 are teammates.",
        usage: "!newplayer <1–4> <PUBG nickname>",
        roles: ["mods"],
      },
      {
        id: "deleteplayer",
        name: "!deleteplayer",
        description:
          "Remove a teammate from the PUBG roster. The main player cannot be removed.",
        usage: "!deleteplayer <2–4>",
        roles: ["mods"],
      },
    ],
  },
  {
    id: "gambling",
    label: "Gambling",
    description:
      "No Twitch chat commands are documented in this category yet.",
    commands: [],
  },
  {
    id: "votes",
    label: "Votes",
    description:
      "Broadcasters can add polls and custom voting commands here.",
    commands: [],
  },
  {
    id: "others",
    label: "Other",
    description: "Points, clips, and moderator tools.",
    commands: [
      {
        id: "points",
        name: "!points",
        description: "Show a user's Twitch CustomBody balance.",
        usage: "!points",
        roles: ["everyone"],
      },
      {
        id: "givepoints",
        name: "!givepoints",
        description:
          "Transfer Twitch CustomBody points from the sender to another user.",
        usage: "!givepoints <user> <amount>",
        roles: ["everyone"],
      },
      {
        id: "addpoints",
        name: "!addpoints",
        description: "Add Twitch CustomBody points to a user.",
        usage: "!addpoints <user> <amount>",
        roles: ["mods"],
      },
      {
        id: "removepoints",
        name: "!removepoints",
        description: "Remove Twitch CustomBody points from a user.",
        usage: "!removepoints <user> <amount>",
        roles: ["mods"],
      },
      {
        id: "clip",
        name: "!clip / !klip",
        description: "Create a 30-second Twitch clip and post its link in chat.",
        usage: "!clip or !klip",
        roles: ["everyone"],
      },
      {
        id: "title",
        name: "!title",
        description: "Change the stream title.",
        usage: "!title <new title>",
        roles: ["mods"],
      },
      {
        id: "game",
        name: "!game / !category",
        description: "Change the stream's game or category.",
        usage: "!game <game or category>",
        roles: ["mods"],
      },
      {
        id: "marker",
        name: "!marker",
        description: "Create a stream marker with an optional description.",
        usage: "!marker [description]",
        roles: ["mods"],
      },
    ],
  },
];
