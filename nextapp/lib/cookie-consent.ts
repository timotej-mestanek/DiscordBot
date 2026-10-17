export type CookieConsent = "accepted" | "declined" | "unset";

export const COOKIE_CONSENT_EVENT = "n4jt-cookie-consent-change";
export const COOKIE_CONSENT_REQUEST_EVENT = "n4jt-cookie-consent-request";
const CONSENT_COOKIE = "n4jt_optional_storage_consent";

export function getCookieConsent(): CookieConsent {
  if (typeof document === "undefined") return "unset";
  const consent = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${CONSENT_COOKIE}=`))
    ?.split("=")[1];

  return consent === "accepted" || consent === "declined" ? consent : "unset";
}

export function setCookieConsent(consent: Exclude<CookieConsent, "unset">) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${consent}; Path=/; Max-Age=15552000; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
}

export function clearCookieConsent() {
  document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
}

export function requestCookieConsent() {
  window.dispatchEvent(new Event(COOKIE_CONSENT_REQUEST_EVENT));
}
