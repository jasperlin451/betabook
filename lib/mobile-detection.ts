export type MobilePlatform = "ios" | "android" | "other";
export type MobileBrowser = "chrome" | "safari" | "other";

const MOBILE_HELPER_DISMISS_KEY = "betabook:hide-mobile-app-helper";

/**
 * Detects if the platform is iOS, Android, or other based on user agent and navigator details.
 */
export function detectMobilePlatform(
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
  platform = typeof navigator !== "undefined" ? (navigator.platform ?? "") : "",
  maxTouchPoints = typeof navigator !== "undefined" ? (navigator.maxTouchPoints ?? 0) : 0,
): MobilePlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent) || /iPhone|iPad|iPod/i.test(platform)) {
    return "ios";
  }
  // iPad on iOS 13+ reports user agent as MacIntel/Macintosh with touch points
  if (
    (/Macintosh|MacIntel/i.test(platform) || /Macintosh|MacIntel/i.test(userAgent)) &&
    maxTouchPoints > 1
  ) {
    return "ios";
  }
  if (/Android/i.test(userAgent) || /Android/i.test(platform)) {
    return "android";
  }
  return "other";
}

/**
 * Detects if the browser is Chrome, Safari, or another browser.
 */
export function detectMobileBrowser(
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
): MobileBrowser {
  // Chrome on iOS uses "CriOS"
  if (/CriOS/i.test(userAgent)) {
    return "chrome";
  }
  // Chrome on Android / Chromium-based browsers, excluding Edge, Opera, Samsung Internet
  if (/Chrome|Chromium/i.test(userAgent) && !/EdgA|OPR|SamsungBrowser|UCBrowser/i.test(userAgent)) {
    return "chrome";
  }
  // Safari: contains Safari, but not Chrome, Chromium, Firefox, Edge, Opera, or Samsung
  if (
    /Safari/i.test(userAgent) &&
    !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|SamsungBrowser|UCBrowser/i.test(userAgent)
  ) {
    return "safari";
  }
  return "other";
}

/**
 * Detects whether the current display mode is standalone or minimal-ui (i.e. already installed as a PWA / home screen shortcut).
 */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined" || window.matchMedia == null) return false;
  const isStandaloneMatch =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches;
  const isNavStandalone =
    typeof navigator !== "undefined" &&
    "standalone" in navigator &&
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return isStandaloneMatch || isNavStandalone;
}

/**
 * Checks if the user agent or platform indicates a mobile or tablet device.
 */
export function isMobileDevice(
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
  platform = typeof navigator !== "undefined" ? (navigator.platform ?? "") : "",
  maxTouchPoints = typeof navigator !== "undefined" ? (navigator.maxTouchPoints ?? 0) : 0,
): boolean {
  if (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
    /iPhone|iPad|iPod/i.test(platform)
  ) {
    return true;
  }
  if (
    (/Macintosh|MacIntel/i.test(userAgent) || /Macintosh|MacIntel/i.test(platform)) &&
    maxTouchPoints > 1
  ) {
    return true;
  }
  return false;
}

/**
 * Checks if the mobile app helper has been dismissed by the user in localStorage.
 */
export function isMobileHelperDismissed(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(MOBILE_HELPER_DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Persists dismissal of the mobile app helper to localStorage.
 */
export function setMobileHelperDismissed(dismissed = true): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (dismissed) {
      localStorage.setItem(MOBILE_HELPER_DISMISS_KEY, "true");
    } else {
      localStorage.removeItem(MOBILE_HELPER_DISMISS_KEY);
    }
  } catch {
    // Ignore storage quota or privacy errors
  }
}
