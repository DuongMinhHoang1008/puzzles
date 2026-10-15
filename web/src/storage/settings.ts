import type { Locale } from "../engine/contract";
export interface Settings {
  locale: Locale;
  dark: boolean;
  sound: boolean;
  reduced: boolean;
  favorites: string[];
}
export function readSettings(): Settings {
  const defaults: Settings = {
    locale: navigator.language.startsWith("vi") ? "vi" : "en",
    dark: matchMedia("(prefers-color-scheme: dark)").matches,
    sound: false,
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    favorites: [],
  };
  try {
    const s = JSON.parse(
      localStorage.getItem("puzzle-studio-settings") || "{}",
    );
    return {
      locale:
        s.locale === "en" || s.locale === "vi" ? s.locale : defaults.locale,
      dark: typeof s.dark === "boolean" ? s.dark : defaults.dark,
      sound: s.sound === true,
      reduced: typeof s.reduced === "boolean" ? s.reduced : defaults.reduced,
      favorites: Array.isArray(s.favorites)
        ? s.favorites.filter((v: unknown) => typeof v === "string")
        : [],
    };
  } catch {
    return defaults;
  }
}
export function writeSettings(s: Settings) {
  try {
    localStorage.setItem("puzzle-studio-settings", JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
