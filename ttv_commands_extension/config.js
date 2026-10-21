(() => {
  "use strict";

  const elements = {
    groupForm: document.getElementById("group-form"),
    groupLabel: document.getElementById("group-label"),
    commandForm: document.getElementById("command-form"),
    commandGroup: document.getElementById("command-group"),
    commandName: document.getElementById("command-name"),
    commandDescription: document.getElementById("command-description"),
    commandUsage: document.getElementById("command-usage"),
    configJson: document.getElementById("config-json"),
    applyJson: document.getElementById("apply-json"),
    save: document.getElementById("save-config"),
    status: document.getElementById("status"),
    error: document.getElementById("error"),
    importUrl: document.getElementById("import-url"),
    loadUrl: document.getElementById("load-url"),
    importJson: document.getElementById("import-json"),
    loadPasted: document.getElementById("load-pasted"),
  };

  let groups = window.TTVCommands.defaults.groups;

  function setError(message) {
    elements.error.textContent = message;
    elements.error.hidden = !message;
  }

  function setStatus(message) {
    elements.status.textContent = message;
  }

  function writeGroups(nextGroups) {
    groups = nextGroups;
    elements.configJson.value = JSON.stringify(
      { schemaVersion: 1, groups },
      null,
      2,
    );
    renderGroupOptions();
  }

  function normalizeEditor() {
    try {
      const normalized = window.TTVCommands.normalizeConfig(
        JSON.parse(elements.configJson.value),
      );
      return normalized;
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "JSON konfigurace není platný.",
      );
    }
  }

  function renderGroupOptions() {
    const previousSelection = elements.commandGroup.value;
    elements.commandGroup.replaceChildren();
    for (const group of groups) {
      const option = document.createElement("option");
      option.value = group.id;
      option.textContent = group.label;
      elements.commandGroup.append(option);
    }
    if (groups.some((group) => group.id === previousSelection)) {
      elements.commandGroup.value = previousSelection;
    }
  }

  function importJson(source) {
    const normalized = window.TTVCommands.normalizeConfig(JSON.parse(source));
    writeGroups(normalized.groups);
    setError("");
    setStatus("JSON ověřen a načten. Nezapomeň změny uložit do Twitch.");
  }

  function readSavedConfig() {
    const content = window.Twitch?.ext?.configuration?.broadcaster?.content;
    if (!content) {
      writeGroups(window.TTVCommands.defaults.groups);
      setStatus("Načteny výchozí příkazy. Ulož konfiguraci pro svůj kanál.");
      return;
    }
    try {
      const normalized = window.TTVCommands.normalizeConfig(JSON.parse(content));
      writeGroups(normalized.groups);
      setStatus("Načtena konfigurace uložená pro tento kanál.");
      setError("");
    } catch (error) {
      console.error("Twitch commands configuration is invalid:", error);
      writeGroups(window.TTVCommands.defaults.groups);
      setStatus("Uložená konfigurace je neplatná; načteny výchozí příkazy.");
      setError(error instanceof Error ? error.message : "Neplatná konfigurace.");
    }
  }

  function makeId(label, fallback) {
    const normalized = label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const base = normalized || fallback;
    let id = base;
    let suffix = 2;
    while (groups.some((group) => group.id === id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    return id;
  }

  function makeCommandId(label) {
    const base =
      label
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || `command-${Date.now()}`;
    const existingIds = new Set(
      groups.flatMap((group) => group.commands.map((command) => command.id)),
    );
    let id = base;
    let suffix = 2;
    while (existingIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    return id;
  }

  elements.groupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      groups = normalizeEditor().groups;
      const label = elements.groupLabel.value.trim();
      if (!label) throw new Error("Zadej název kategorie.");
      if (groups.some((group) => group.label.toLocaleLowerCase("cs") === label.toLocaleLowerCase("cs"))) {
        throw new Error("Kategorie s tímto názvem už existuje.");
      }
      const id = makeId(label, `group-${groups.length + 1}`);
      writeGroups([
        ...groups,
        { id, label, description: "", commands: [] },
      ]);
      elements.commandGroup.value = id;
      elements.groupLabel.value = "";
      setError("");
      setStatus(`Kategorie „${label}“ přidána do JSON. Ulož změny do Twitch.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Kategorii se nepodařilo přidat.");
    }
  });

  elements.commandForm.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      groups = normalizeEditor().groups;
      const name = elements.commandName.value.trim();
      const description = elements.commandDescription.value.trim();
      const targetGroup = groups.find(
        (group) => group.id === elements.commandGroup.value,
      );
      if (!targetGroup) throw new Error("Vyber existující kategorii.");
      if (!name || !description) {
        throw new Error("Vyplň příkaz i jeho popis.");
      }
      const selectedRoles = [
        ...document.querySelectorAll('input[name="role"]:checked'),
      ].map((input) => input.value);
      if (selectedRoles.length === 0) {
        throw new Error("Vyber alespoň jednu roli.");
      }
      const commandId = makeCommandId(name);
      const nextGroups = groups.map((group) =>
        group.id === targetGroup.id
          ? {
              ...group,
              commands: [
                ...group.commands,
                {
                  id: commandId,
                  name,
                  description,
                  ...(elements.commandUsage.value.trim()
                    ? { usage: elements.commandUsage.value.trim() }
                    : {}),
                  roles: selectedRoles,
                },
              ],
            }
          : group,
      );
      writeGroups(nextGroups);
      elements.commandName.value = "";
      elements.commandDescription.value = "";
      elements.commandUsage.value = "";
      setError("");
      setStatus(`Příkaz „${name}“ přidán do JSON. Ulož změny do Twitch.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Příkaz se nepodařilo přidat.");
    }
  });

  elements.configJson.addEventListener("input", () => {
    try {
      groups = normalizeEditor().groups;
      renderGroupOptions();
      setError("");
    } catch {
      // Keep the text editable; parsing errors are shown on validation or save.
    }
  });

  elements.applyJson.addEventListener("click", () => {
    try {
      const normalized = normalizeEditor();
      writeGroups(normalized.groups);
      setError("");
      setStatus("JSON je platný a načtený do editoru.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "JSON není platný.");
    }
  });

  elements.save.addEventListener("click", () => {
    try {
      const normalized = normalizeEditor();
      const content = JSON.stringify(normalized);
      if (new TextEncoder().encode(content).length > 5_000) {
        throw new Error(
          "Konfigurace je větší než 5 KB. Zkrať popisy nebo odeber nepoužívané příkazy.",
        );
      }
      if (!window.Twitch?.ext?.configuration?.set) {
        throw new Error("Twitch konfigurace není dostupná. Otevři tento view v Twitch Extension.");
      }
      window.Twitch.ext.configuration.set(
        "broadcaster",
        "1",
        content,
      );
      writeGroups(normalized.groups);
      setError("");
      setStatus("Konfigurace byla předána Twitch. Uložení se může propsat za chvíli.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Konfiguraci se nepodařilo uložit.");
    }
  });

  elements.loadPasted.addEventListener("click", () => {
    try {
      if (!elements.importJson.value.trim()) {
        throw new Error("Vlož JSON, který chceš importovat.");
      }
      importJson(elements.importJson.value);
    } catch (error) {
      setError(error instanceof Error ? error.message : "JSON se nepodařilo načíst.");
    }
  });

  elements.loadUrl.addEventListener("click", async () => {
    const url = elements.importUrl.value.trim();
    if (!url) {
      setError("Zadej URL veřejného JSON feedu.");
      return;
    }
    elements.loadUrl.disabled = true;
    setError("");
    setStatus("Načítám JSON z adresy…");
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost") {
        throw new Error("Importovaná adresa musí používat HTTPS.");
      }
      const response = await fetch(parsedUrl, { mode: "cors", cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Server vrátil HTTP ${response.status}.`);
      }
      const text = await response.text();
      if (new TextEncoder().encode(text).length > 250_000) {
        throw new Error("Importovaný JSON je příliš velký (limit 250 KB).");
      }
      elements.importJson.value = text;
      importJson(text);
    } catch (error) {
      console.error("Commands JSON URL import failed:", error);
      setError(
        error instanceof Error
          ? error.message
          : "JSON z adresy se nepodařilo načíst.",
      );
      setStatus("Import se nezdařil.");
    } finally {
      elements.loadUrl.disabled = false;
    }
  });

  writeGroups(window.TTVCommands.defaults.groups);
  elements.importUrl.value = "https://najtik.stream/api/ttv-commands";
  if (window.Twitch?.ext) {
    window.Twitch.ext.onAuthorized(readSavedConfig);
    window.Twitch.ext.configuration.onChanged(readSavedConfig);
  } else {
    setStatus("Twitch Extension API není dostupné; zobrazena výchozí konfigurace.");
  }
})();
