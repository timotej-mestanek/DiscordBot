(() => {
  "use strict";

  const numberFormat = new Intl.NumberFormat("cs-CZ", {
    maximumFractionDigits: 1,
  });
  const integerFormat = new Intl.NumberFormat("cs-CZ", {
    maximumFractionDigits: 0,
  });

  const elements = {
    connection: document.getElementById("connection"),
    emptyState: document.getElementById("empty-state"),
    stats: document.getElementById("stats"),
    player: document.getElementById("player"),
    matches: document.getElementById("matches"),
    kd: document.getElementById("kd"),
    kills: document.getElementById("kills"),
    deaths: document.getElementById("deaths"),
    longestKill: document.getElementById("longest-kill"),
    headshotRate: document.getElementById("headshot-rate"),
    mostDamage: document.getElementById("most-damage"),
    averageDamage: document.getElementById("average-damage"),
    error: document.getElementById("error"),
    updatedAt: document.getElementById("updated-at"),
  };

  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function formatNumber(value, digits = 0) {
    if (!isFiniteNumber(value)) return "—";
    return (digits === 0 ? integerFormat : numberFormat).format(value);
  }

  function setConnection(text, state) {
    elements.connection.textContent = text;
    elements.connection.dataset.state = state;
  }

  function showError(message) {
    elements.error.textContent = message;
    elements.error.hidden = false;
  }

  function renderStats(data) {
    if (
      !isRecord(data) ||
      typeof data.player !== "string" ||
      !isFiniteNumber(data.matches) ||
      !isFiniteNumber(data.kills) ||
      !isFiniteNumber(data.deaths) ||
      !(data.kd === null || isFiniteNumber(data.kd)) ||
      !isFiniteNumber(data.longestKill) ||
      !isFiniteNumber(data.headshotRate) ||
      !isFiniteNumber(data.mostDamage) ||
      !isFiniteNumber(data.averageDamage)
    ) {
      showError("Prijatá správa neobsahuje platné PUBG štatistiky.");
      return;
    }

    elements.player.textContent = data.player;
    elements.matches.textContent = `${integerFormat.format(data.matches)} ${
      data.matches === 1 ? "zápas" : "zápasov"
    }`;
    elements.kd.textContent = formatNumber(data.kd, 2);
    elements.kills.textContent = formatNumber(data.kills);
    elements.deaths.textContent = formatNumber(data.deaths);
    elements.longestKill.textContent = formatNumber(data.longestKill, 1);
    elements.headshotRate.textContent = formatNumber(data.headshotRate, 1);
    elements.mostDamage.textContent = formatNumber(data.mostDamage);
    elements.averageDamage.textContent = formatNumber(data.averageDamage, 1);

    elements.emptyState.hidden = true;
    elements.stats.hidden = false;
    elements.error.hidden = true;

    const updatedAt = new Date().toLocaleTimeString("cs-CZ", {
      hour: "2-digit",
      minute: "2-digit",
    });
    elements.updatedAt.textContent = `Aktualizováno ${updatedAt}`;
    elements.updatedAt.hidden = false;
  }

  function handlePubSubMessage(_target, _contentType, message) {
    let payload = message;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (error) {
        console.error("Twitch Extension PubSub sent invalid JSON:", error);
        showError("Zo služby PubSub prišla neplatná správa.");
        return;
      }
    }

    if (!isRecord(payload) || payload.type !== "pubg") return;
    renderStats(payload.data);
  }

  if (!window.Twitch || !window.Twitch.ext) {
    setConnection("Twitch nedostupný", "error");
    showError("Panel je potrebné otvoriť v Twitch Extension.");
    return;
  }

  window.Twitch.ext.onAuthorized(() => {
    setConnection("Pripojené", "connected");
  });

  window.Twitch.ext.listen("broadcast", handlePubSubMessage);
})();
