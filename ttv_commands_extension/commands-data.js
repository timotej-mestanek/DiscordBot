(() => {
  "use strict";

  const roles = new Set(["everyone", "vip", "mods"]);

  const defaults = {
    schemaVersion: 1,
    groups: [
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
            description: "Vynuluje limit zatočení kola pro právě hranou hru.",
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
        description: "Přidej sem vlastní gambling příkazy.",
        commands: [],
      },
      {
        id: "votes",
        label: "Votes",
        description: "Přidej sem vlastní příkazy pro hlasování.",
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
            description:
              "Vytvoří 30sekundový Twitch klip a pošle odkaz do chatu.",
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
    ],
  };

  function slug(value) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function normalizeConfig(input) {
    const groups = Array.isArray(input) ? input : input?.groups;
    if (!Array.isArray(groups) || groups.length > 80) {
      throw new Error("JSON musí obsahovat pole groups (nejvýše 80 skupin).");
    }

    const usedGroupIds = new Set();
    const usedCommandIds = new Set();
    let commandCount = 0;
    const normalizedGroups = groups.map((group, groupIndex) => {
      if (!group || typeof group !== "object" || Array.isArray(group)) {
        throw new Error(`Skupina ${groupIndex + 1} musí být objekt.`);
      }
      const label =
        typeof group.label === "string"
          ? group.label.trim()
          : typeof group.name === "string"
            ? group.name.trim()
            : "";
      if (!label || label.length > 80) {
        throw new Error(`Skupina ${groupIndex + 1} potřebuje název do 80 znaků.`);
      }
      const baseId =
        typeof group.id === "string" && group.id.trim()
          ? slug(group.id)
          : slug(label);
      let id = baseId || `group-${groupIndex + 1}`;
      if (usedGroupIds.has(id)) {
        id = `${id}-${groupIndex + 1}`;
      }
      usedGroupIds.add(id);
      const description =
        typeof group.description === "string"
          ? group.description.trim().slice(0, 240)
          : "";
      if (!Array.isArray(group.commands)) {
        throw new Error(`Skupina „${label}“ potřebuje pole commands.`);
      }

      const commands = group.commands.map((command, commandIndex) => {
        commandCount += 1;
        if (
          commandCount > 300 ||
          !command ||
          typeof command !== "object" ||
          Array.isArray(command)
        ) {
          throw new Error("JSON může obsahovat nejvýše 300 platných příkazů.");
        }
        const name =
          typeof command.name === "string"
            ? command.name.trim()
            : typeof command.command === "string"
              ? command.command.trim()
              : "";
        const commandDescription =
          typeof command.description === "string"
            ? command.description.trim()
            : typeof command.body === "string"
              ? command.body.trim()
              : "";
        if (!name || name.length > 120 || !commandDescription) {
          throw new Error(
            `Příkaz ${commandIndex + 1} ve skupině „${label}“ potřebuje název a popis.`,
          );
        }
        const rawRoles = command.roles ?? command.access ?? ["everyone"];
        if (!Array.isArray(rawRoles) || rawRoles.length === 0) {
          throw new Error(`Příkaz „${name}“ potřebuje alespoň jednu roli.`);
        }
        const normalizedRoles = [
          ...new Set(
            rawRoles.map((role) => {
              if (["everyone", "all", "viewers", "viewer"].includes(role)) {
                return "everyone";
              }
              if (role === "vip") return "vip";
              if (["mods", "moderators", "moderator", "mod"].includes(role)) {
                return "mods";
              }
              throw new Error(
                `Příkaz „${name}“ má neznámou roli „${String(role)}“. Použij everyone, vip nebo mods.`,
              );
            }),
          ),
        ];
        if (normalizedRoles.includes("everyone")) {
          normalizedRoles.splice(0, normalizedRoles.length, "everyone");
        }
        const commandBaseId =
          typeof command.id === "string" && command.id.trim()
            ? slug(command.id)
            : `${id}-${commandIndex + 1}`;
        let commandId = commandBaseId || `${id}-${commandIndex + 1}`;
        if (usedCommandIds.has(commandId)) {
          commandId = `${commandId}-${groupIndex + 1}-${commandIndex + 1}`;
        }
        usedCommandIds.add(commandId);
        const usage =
          typeof command.usage === "string"
            ? command.usage.trim().slice(0, 180)
            : "";
        return {
          id: commandId || `${id}-${commandIndex + 1}`,
          name,
          description: commandDescription.slice(0, 1_000),
          ...(usage ? { usage } : {}),
          roles: normalizedRoles,
        };
      });

      return { id, label, description, commands };
    });

    return { schemaVersion: 1, groups: normalizedGroups };
  }

  window.TTVCommands = {
    defaults,
    normalizeConfig,
    roleLabels: {
      everyone: "Všichni",
      vip: "VIP",
      mods: "Moderátoři",
    },
    validRoles: roles,
  };
})();
