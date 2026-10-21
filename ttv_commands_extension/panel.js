(() => {
  "use strict";

  const roleOrder = ["everyone", "vip", "mods"];
  const roleLabels = {
    everyone: "Všichni",
    vip: "VIP",
    mods: "Mod",
  };
  const elements = {
    search: document.getElementById("search-input"),
    groupNavigation: document.getElementById("group-navigation"),
    roleNavigation: document.getElementById("role-navigation"),
    groups: document.getElementById("groups"),
    empty: document.getElementById("empty-state"),
    count: document.getElementById("command-count"),
    notice: document.getElementById("config-notice"),
    footerCategory: document.getElementById("footer-category"),
  };

  let config = window.TTVCommands.defaults;
  let selectedGroup = "all";
  let selectedRole = "all";

  function makeFilterButton(label, value, selected, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-button";
    button.textContent = label;
    button.setAttribute("aria-pressed", String(selected === value));
    button.addEventListener("click", onClick);
    return button;
  }

  function renderNavigation() {
    elements.groupNavigation.replaceChildren();
    elements.groupNavigation.append(
      makeFilterButton("Vše", "all", selectedGroup, () => {
        selectedGroup = "all";
        render();
      }),
    );
    for (const group of config.groups) {
      elements.groupNavigation.append(
        makeFilterButton(group.label, group.id, selectedGroup, () => {
          selectedGroup = group.id;
          render();
        }),
      );
    }

    elements.roleNavigation.replaceChildren();
    const roleFilters = [
      ["all", "Všechny role"],
      ...roleOrder.map((role) => [role, roleLabels[role]]),
    ];
    for (const [role, label] of roleFilters) {
      elements.roleNavigation.append(
        makeFilterButton(label, role, selectedRole, () => {
          selectedRole = role;
          render();
        }),
      );
    }
  }

  function getVisibleGroups() {
    const query = elements.search.value.trim().toLocaleLowerCase("cs");
    return config.groups
      .filter((group) => selectedGroup === "all" || group.id === selectedGroup)
      .map((group) => ({
        ...group,
        commands: group.commands.filter((command) => {
          const matchesRole =
            selectedRole === "all" ||
            command.roles.includes("everyone") ||
            command.roles.includes(selectedRole);
          const searchText =
            `${command.name} ${command.description} ${command.usage || ""} ${group.label}`
              .toLocaleLowerCase("cs");
          return matchesRole && (!query || searchText.includes(query));
        }),
      }));
  }

  function appendRoleBadge(container, role) {
    const badge = document.createElement("span");
    badge.className = `role-badge ${role === "everyone" ? "" : role}`;
    badge.textContent = roleLabels[role] || role;
    container.append(badge);
  }

  function renderCommand(command) {
    const card = document.createElement("article");
    card.className = "command-card";

    const top = document.createElement("div");
    top.className = "command-top";
    const name = document.createElement("h3");
    name.className = "command-name";
    name.textContent = command.name;
    const badges = document.createElement("div");
    badges.className = "role-badges";
    for (const role of command.roles) appendRoleBadge(badges, role);
    top.append(name, badges);

    const description = document.createElement("p");
    description.className = "command-description";
    description.textContent = command.description;
    card.append(top, description);

    if (command.usage) {
      const usage = document.createElement("code");
      usage.className = "command-usage";
      usage.textContent = command.usage;
      card.append(usage);
    }
    return card;
  }

  function render() {
    renderNavigation();
    const visibleGroups = getVisibleGroups();
    const visibleCount = visibleGroups.reduce(
      (total, group) => total + group.commands.length,
      0,
    );
    elements.count.textContent = `${visibleCount} ${visibleCount === 1 ? "příkaz" : "příkazů"}`;
    elements.footerCategory.textContent =
      selectedGroup === "all"
        ? "Všechny kategorie"
        : config.groups.find((group) => group.id === selectedGroup)?.label || "";
    elements.groups.replaceChildren();

    for (const group of visibleGroups) {
      if (group.commands.length === 0) continue;
      const section = document.createElement("section");
      const heading = document.createElement("div");
      heading.className = "group-heading";
      const title = document.createElement("h2");
      title.textContent = group.label;
      const count = document.createElement("span");
      count.textContent = `${group.commands.length}`;
      heading.append(title, count);
      section.append(heading);
      if (group.description) {
        const description = document.createElement("p");
        description.className = "group-description";
        description.textContent = group.description;
        section.append(description);
      }
      const commandList = document.createElement("div");
      commandList.className = "command-list";
      for (const command of group.commands) {
        commandList.append(renderCommand(command));
      }
      section.append(commandList);
      elements.groups.append(section);
    }

    elements.empty.hidden = visibleCount > 0;
  }

  function loadBroadcasterConfig() {
    const content = window.Twitch?.ext?.configuration?.broadcaster?.content;
    if (!content) return;
    try {
      config = window.TTVCommands.normalizeConfig(JSON.parse(content));
      selectedGroup = "all";
      render();
      elements.notice.hidden = true;
    } catch (error) {
      console.error("Twitch commands extension received invalid configuration:", error);
      elements.notice.textContent =
        "Konfiguraci tohoto kanálu se nepodařilo načíst. Zobrazuji výchozí příkazy.";
      elements.notice.hidden = false;
    }
  }

  elements.search.addEventListener("input", render);
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "/" &&
      document.activeElement !== elements.search &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      elements.search.focus();
    }
  });

  render();

  if (window.Twitch?.ext) {
    window.Twitch.ext.onAuthorized(() => loadBroadcasterConfig());
    window.Twitch.ext.configuration.onChanged(() => loadBroadcasterConfig());
  }
})();
