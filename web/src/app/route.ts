import type { Locale } from "../engine/contract";
export interface Route {
  id?: string;
  fullId?: string;
  locale?: Locale;
  error?: string;
}
export function parseRoute(hash: string, ids: readonly string[]): Route {
  if (!hash || hash === "#/" || hash === "#") return {};
  const [path, query = ""] = hash.slice(1).split("?");
  const match = /^\/play\/([a-z]+)$/.exec(path);
  if (!match || !ids.includes(match[1])) return { error: "route" };
  const params = new URLSearchParams(query);
  const fullId = params.get("game") ?? undefined,
    lang = params.get("lang");
  if (
    (fullId && (fullId.length > 8192 || /[\x00-\x1f\x7f]/.test(fullId))) ||
    (lang && lang !== "en" && lang !== "vi")
  )
    return { error: "route" };
  return { id: match[1], fullId, locale: (lang as Locale | null) ?? undefined };
}
export function shareHash(id: string, fullId: string, locale: Locale) {
  return `#/play/${id}?${new URLSearchParams({ game: fullId, lang: locale })}`;
}
