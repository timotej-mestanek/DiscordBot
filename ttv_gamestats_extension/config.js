(() => {
  "use strict";

  const CONFIG_VERSION = "1";
  const MAX_CONFIG_BYTES = 5_000;
  const DEFAULT_MESSAGE = {
    type: "gamestats",
    updatedAt: new Date().toISOString(),
    data: {
      stream: { isLive: true },
      game: { id: "pubg", name: "PUBG" },
      supported: true,
      players: [],
    },
  };

  const elements = {
    editor: document.getElementById("config-json"),
    save: document.getElementById("save-config"),
    apply: document.getElementById("apply-json"),
    status: document.getElementById("status"),
    error: document.getElementById("error"),
  };

  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function setError(message) {
    elements.error.textContent = message;
    elements.error.hidden = !message;
  }

  function setStatus(message) {
    elements.status.textContent = message;
  }

  function parseMessage(value) {
    if (!isRecord(value) || value.type !== "gamestats" || !isRecord(value.data)) {
      throw new Error("JSON must be a gamestats message with a data object.");
    }
    if (!isRecord(value.data.stream) || typeof value.data.stream.isLive !== "boolean") {
      throw new Error("data.stream.isLive must be true or false.");
    }
    if (
      !isRecord(value.data.game) ||
      typeof value.data.game.name !== "string" ||
      !value.data.game.name.trim()
    ) {
      throw new Error("data.game.name is required.");
    }
    if (
      value.data.players !== undefined &&
      (!Array.isArray(value.data.players) ||
        value.data.players.length > 20 ||
        !value.data.players.every(
          (player) =>
            isRecord(player) &&
            typeof player.name === "string" &&
            player.name.trim() &&
            isRecord(player.stats),
        ))
    ) {
      throw new Error("data.players must be an array of valid player objects.");
    }
    const normalized = {
      type: "gamestats",
      ...(typeof value.updatedAt === "string" ? { updatedAt: value.updatedAt } : {}),
      data: value.data,
    };
    if (new TextEncoder().encode(JSON.stringify(normalized)).length > MAX_CONFIG_BYTES) {
      throw new Error("Configuration exceeds Twitch's 5 KB limit.");
    }
    return normalized;
  }

  function readSavedConfig() {
    const content = window.Twitch?.ext?.configuration?.broadcaster?.content;
    if (!content) {
      elements.editor.value = JSON.stringify(DEFAULT_MESSAGE, null, 2);
      setStatus("No saved snapshot. The sample is ready to edit.");
      return;
    }
    try {
      elements.editor.value = JSON.stringify(parseMessage(JSON.parse(content)), null, 2);
      setStatus("Loaded the snapshot saved for this channel.");
      setError("");
    } catch (error) {
      console.error("Game stats configuration is invalid:", error);
      setStatus("Saved configuration is invalid.");
      setError(error instanceof Error ? error.message : "Invalid configuration.");
    }
  }

  function validateEditor() {
    const parsed = parseMessage(JSON.parse(elements.editor.value));
    elements.editor.value = JSON.stringify(parsed, null, 2);
    setError("");
    setStatus("JSON is valid and ready to save.");
    return parsed;
  }

  elements.apply.addEventListener("click", () => {
    try {
      validateEditor();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Invalid JSON.");
    }
  });

  elements.save.addEventListener("click", () => {
    try {
      const message = validateEditor();
      if (!window.Twitch?.ext?.configuration?.set) {
        throw new Error("Twitch configuration is unavailable in this view.");
      }
      window.Twitch.ext.configuration.set(
        "broadcaster",
        CONFIG_VERSION,
        JSON.stringify(message),
      );
      setStatus("Snapshot sent to Twitch. It will be available to new viewers.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save configuration.");
    }
  });

  elements.editor.value = JSON.stringify(DEFAULT_MESSAGE, null, 2);
  if (window.Twitch?.ext) {
    window.Twitch.ext.onAuthorized(readSavedConfig);
    window.Twitch.ext.configuration.onChanged(readSavedConfig);
  } else {
    setStatus("Twitch Extension API is unavailable; editing the sample locally.");
  }
})();
