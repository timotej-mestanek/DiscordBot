export function getAppUrl(requestUrl: string): URL {
  const configuredUrl = process.env.APP_URL?.trim();
  if (!configuredUrl && process.env.NODE_ENV === "production") {
    throw new Error("APP_URL must be set to the public site origin in production.");
  }

  const appUrl = new URL(configuredUrl || requestUrl);
  if (appUrl.protocol !== "http:" && appUrl.protocol !== "https:") {
    throw new Error("APP_URL must use HTTP or HTTPS.");
  }
  if (
    configuredUrl &&
    (appUrl.username ||
      appUrl.password ||
      appUrl.pathname !== "/" ||
      appUrl.search ||
      appUrl.hash)
  ) {
    throw new Error("APP_URL must contain only the public site origin.");
  }
  if (["0.0.0.0", "[::]"].includes(appUrl.hostname)) {
    throw new Error("Set APP_URL to the public site origin, not the Docker bind address.");
  }

  return new URL(appUrl.origin);
}
