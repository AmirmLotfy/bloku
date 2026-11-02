import product from "../../shared/product.json";
import type { LocaleCode, PageId } from "./types";

export const routes: Record<PageId, string> = {
  home: "",
  "ad-blocking": "features/ad-blocking",
  "privacy-feature": "features/privacy",
  "distraction-control": "features/distraction-control",
  focus: "features/focus",
  support: "support",
  privacy: "privacy",
  terms: "terms",
  hey: "hey",
  bye: "bye",
  changelog: "changelog",
  "not-found": "404",
};
export const publicPages = Object.keys(routes).filter(
  (p) => !["hey", "bye", "not-found"].includes(p),
) as PageId[];
export function localeInfo(code: LocaleCode) {
  return product.locales.find((item) => item.code === code)!;
}
export function pagePath(locale: LocaleCode, page: PageId): string {
  const segments = [localeInfo(locale).path, routes[page]].filter(Boolean);
  return segments.length ? `/${segments.join("/")}` : "/";
}
export function resolvePath(pathname: string): {
  locale: LocaleCode;
  page: PageId;
} {
  const path = decodeURI(pathname).replace(/\/+$/, "") || "/";
  for (const locale of product.locales) {
    for (const page of Object.keys(routes) as PageId[]) {
      if (pagePath(locale.code as LocaleCode, page) === path)
        return { locale: locale.code as LocaleCode, page };
    }
  }
  const segment = path.split("/")[1];
  const locale = product.locales.find(
    (item) => item.path && item.path === segment,
  )?.code as LocaleCode | undefined;
  return { locale: locale || "en", page: "not-found" };
}
