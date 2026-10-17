(() => {
  "use strict";

  const elements = {
    connection: document.getElementById("connection"),
    emptyState: document.getElementById("empty-state"),
    emptyTitle: document.getElementById("empty-title"),
    emptyDetail: document.getElementById("empty-detail"),
    track: document.getElementById("track"),
    cover: document.getElementById("cover"),
    coverPlaceholder: document.getElementById("cover-placeholder"),
    trackName: document.getElementById("track-name"),
    artists: document.getElementById("artists"),
    spotifyLink: document.getElementById("spotify-link"),
    error: document.getElementById("error"),
    updatedAt: document.getElementById("updated-at"),
  };

  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function setConnection(text, state) {
    elements.connection.textContent = text;
    elements.connection.dataset.state = state;
  }

  function showError(message) {
    elements.error.textContent = message;
    elements.error.hidden = false;
  }

  function clearError() {
    elements.error.textContent = "";
    elements.error.hidden = true;
  }

  function getHttpsUrl(value) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url : null;
    } catch {
      return null;
    }
  }

  function showEmptyState(title, detail) {
    elements.emptyTitle.textContent = title;
    elements.emptyDetail.textContent = detail;
    elements.emptyState.hidden = false;
    elements.track.hidden = true;
  }

  function updateTimestamp(value) {
    const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
    if (!Number.isFinite(timestamp)) {
      elements.updatedAt.hidden = true;
      return;
    }

    elements.updatedAt.textContent = `Aktualizováno ${new Date(timestamp).toLocaleTimeString(
      "cs-CZ",
      { hour: "2-digit", minute: "2-digit" },
    )}`;
    elements.updatedAt.hidden = false;
  }

  function renderPlayback(data, updatedAt) {
    if (data === null) {
      showEmptyState(
        "Spotify právě nic nepřehrává.",
        "Skladba se zobrazí, až začne přehrávání.",
      );
      clearError();
      updateTimestamp(updatedAt);
      return;
    }

    if (
      !isRecord(data) ||
      typeof data.is_playing !== "boolean" ||
      !("item" in data)
    ) {
      showError("Přijatá zpráva neobsahuje platná data Spotify.");
      return;
    }

    if (!data.is_playing || data.item === null) {
      showEmptyState(
        "Spotify právě nic nepřehrává.",
        "Skladba se zobrazí, až začne přehrávání.",
      );
      clearError();
      updateTimestamp(updatedAt);
      return;
    }

    if (
      !isRecord(data.item) ||
      typeof data.item.name !== "string" ||
      !Array.isArray(data.item.artists) ||
      !data.item.artists.every(
        (artist) => isRecord(artist) && typeof artist.name === "string",
      )
    ) {
      showError("Přijatá zpráva obsahuje neplatné údaje o skladbě.");
      return;
    }

    const artistNames = data.item.artists.map((artist) => artist.name);
    elements.trackName.textContent = data.item.name;
    elements.artists.textContent = artistNames.length
      ? artistNames.join(", ")
      : "Neznámý interpret";

    const imageUrl = isRecord(data.item.album) &&
      Array.isArray(data.item.album.images) &&
      isRecord(data.item.album.images[0])
      ? getHttpsUrl(data.item.album.images[0].url)
      : null;
    if (imageUrl) {
      elements.cover.src = imageUrl.href;
      elements.cover.hidden = false;
      elements.coverPlaceholder.hidden = true;
    } else {
      elements.cover.removeAttribute("src");
      elements.cover.hidden = true;
      elements.coverPlaceholder.hidden = false;
    }

    const spotifyUrl = isRecord(data.item.external_urls)
      ? getHttpsUrl(data.item.external_urls.spotify)
      : null;
    if (spotifyUrl) {
      elements.spotifyLink.href = spotifyUrl.href;
      elements.spotifyLink.hidden = false;
    } else {
      elements.spotifyLink.removeAttribute("href");
      elements.spotifyLink.hidden = true;
    }

    elements.emptyState.hidden = true;
    elements.track.hidden = false;
    clearError();
    updateTimestamp(updatedAt);
  }

  function handlePubSubMessage(_target, _contentType, message) {
    let payload = message;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (error) {
        console.error("Twitch Extension PubSub sent invalid JSON:", error);
        showError("Ze služby PubSub přišla neplatná zpráva.");
        return;
      }
    }

    if (!isRecord(payload) || payload.type !== "spotify") return;
    renderPlayback(payload.data, payload.updatedAt);
  }

  if (!window.Twitch || !window.Twitch.ext) {
    setConnection("Twitch nedostupný", "error");
    showError("Panel je potřeba otevřít v Twitch Extension.");
    return;
  }

  window.Twitch.ext.onAuthorized(() => {
    setConnection("Připojeno", "connected");
  });

  window.Twitch.ext.listen("broadcast", handlePubSubMessage);
})();
