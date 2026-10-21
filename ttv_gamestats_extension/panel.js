(() => {
  "use strict";

  const elements = {
    gameTitle: document.getElementById("game-title"),
    fallback: document.getElementById("fallback"),
    fallbackIcon: document.getElementById("fallback-icon"),
    fallbackTitle: document.getElementById("fallback-title"),
    fallbackDetail: document.getElementById("fallback-detail"),
    playerView: document.getElementById("player-view"),
    playerName: document.getElementById("player-name"),
    playerKd: document.getElementById("player-kd"),
    statsGrid: document.getElementById("stats-grid"),
    playerNavigation: document.getElementById("player-navigation"),
    previousPlayer: document.getElementById("previous-player"),
    nextPlayer: document.getElementById("next-player"),
    playerCount: document.getElementById("player-count"),
  };

  const numberFormat = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  });

  const statLabels = {
    "Ranked zápasy": "Ranked Matches",
    "Headshot rate": "Headshot Rate",
    "Nejdelší kill": "Longest Kill",
    "Nejvyšší damage": "Most Damage",
    "Průměrný damage": "Average Damage",
  };

  const fallbackMessages = {
    invalidFormat: ["Waiting for game stats", "The message has an invalid format."],
    missingLive: ["Waiting for game stats", "The message is missing the stream status."],
    unsupported: (gameName) => [
      "This game is not supported yet",
      `${gameName} stats are not available in the extension yet.`,
    ],
    missingPlayers: ["Waiting for game stats", "The message does not contain player data."],
    noPlayers: ["Stats are not available yet", "No player stats are available for this game."],
    invalidJson: ["Invalid message", "PubSub sent invalid JSON."],
    twitchUnavailable: ["Twitch unavailable", "Open this panel in the Twitch extension."],
  };

  let players = [];
  let selectedPlayerIndex = 0;
  let receivedLiveSnapshot = false;

  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function showFallback(icon, title, detail) {
    elements.fallbackIcon.textContent = icon;
    elements.fallbackTitle.textContent = title;
    elements.fallbackDetail.textContent = detail;
    elements.fallback.hidden = false;
    elements.playerView.hidden = true;
  }

  function formatValue(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return numberFormat.format(value);
    }
    if (typeof value === "string") return value;
    return "—";
  }

  function setFallback(icon, message) {
    showFallback(icon, message[0], message[1]);
  }

  function renderPlayer() {
    const player = players[selectedPlayerIndex];
    elements.playerName.textContent = player.name;
    elements.playerKd.textContent = formatValue(player.kd);
    elements.statsGrid.replaceChildren();

    for (const [label, value] of Object.entries(player.stats)) {
      if (value === null) continue;
      const stat = document.createElement("div");
      stat.className = "stat";

      const statValue = document.createElement("strong");
      statValue.className = "stat-value";
      statValue.textContent = formatValue(value);

      const statLabel = document.createElement("span");
      statLabel.className = "stat-label";
      statLabel.textContent = statLabels[label] ?? label;

      stat.append(statValue, statLabel);
      elements.statsGrid.append(stat);
    }

    elements.previousPlayer.disabled = players.length < 2;
    elements.nextPlayer.disabled = players.length < 2;
    elements.playerCount.textContent = `${selectedPlayerIndex + 1} / ${players.length}`;
  }

  function renderGameStats(data) {
    if (!isRecord(data) || !isRecord(data.stream)) {
      setFallback("⌁", fallbackMessages.invalidFormat);
      return;
    }

    if (data.stream.isLive !== true) {
      setFallback("⌁", fallbackMessages.missingLive);
      return;
    }

    const gameName =
      typeof data.game?.name === "string" ? data.game.name : "Game stats";
    elements.gameTitle.textContent = gameName;

    if (data.supported === false) {
      setFallback("⌁", fallbackMessages.unsupported(gameName));
      return;
    }

    if (!Array.isArray(data.players)) {
      setFallback("⌁", fallbackMessages.missingPlayers);
      return;
    }

    players = data.players.filter(
      (player) =>
        isRecord(player) &&
        typeof player.name === "string" &&
        (player.kd === null ||
          (typeof player.kd === "number" && Number.isFinite(player.kd))) &&
        isRecord(player.stats) &&
        Object.values(player.stats).every(
          (value) =>
            value === null ||
            typeof value === "string" ||
            (typeof value === "number" && Number.isFinite(value)),
        ),
    );

    if (players.length === 0) {
      setFallback("⌁", fallbackMessages.noPlayers);
      return;
    }

    selectedPlayerIndex = 0;
    elements.fallback.hidden = true;
    elements.playerView.hidden = false;
    renderPlayer();
  }

  function handlePubSubMessage(_target, _contentType, message) {
    let payload = message;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (error) {
        console.error("Game stats Extension received invalid JSON:", error);
        setFallback("!", fallbackMessages.invalidJson);
        return;
      }
    }

    if (!isRecord(payload) || payload.type !== "gamestats") return;
    if (
      !isRecord(payload.data) ||
      !isRecord(payload.data.stream) ||
      typeof payload.data.stream.isLive !== "boolean"
    ) {
      renderGameStats(payload.data);
      return;
    }
    receivedLiveSnapshot = true;
    renderGameStats(payload.data);
  }

  function loadSavedSnapshot() {
    if (receivedLiveSnapshot) return;
    const content = window.Twitch?.ext?.configuration?.broadcaster?.content;
    if (!content) return;
    try {
      const snapshot = JSON.parse(content);
      if (!isRecord(snapshot) || snapshot.type !== "gamestats") {
        throw new Error("Saved configuration is not a gamestats message.");
      }
      renderGameStats(snapshot.data);
    } catch (error) {
      console.error("Game stats Extension received invalid broadcaster configuration:", error);
    }
  }

  elements.previousPlayer.addEventListener("click", () => {
    if (players.length < 2) return;
    selectedPlayerIndex = (selectedPlayerIndex - 1 + players.length) % players.length;
    renderPlayer();
  });

  elements.nextPlayer.addEventListener("click", () => {
    if (players.length < 2) return;
    selectedPlayerIndex = (selectedPlayerIndex + 1) % players.length;
    renderPlayer();
  });

  if (!window.Twitch || !window.Twitch.ext) {
    setFallback("!", fallbackMessages.twitchUnavailable);
    return;
  }

  window.Twitch.ext.listen("broadcast", handlePubSubMessage);
  window.Twitch.ext.onAuthorized(loadSavedSnapshot);
  window.Twitch.ext.configuration.onChanged(loadSavedSnapshot);
})();
