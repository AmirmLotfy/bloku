import en from "./en";
import ar from "./ar";
import es from "./es";
import pt_BR from "./pt_BR";
import fr from "./fr";
import de from "./de";
import ja from "./ja";
import hi from "./hi";
import { focus } from "./focus";
import type { Copy, LocaleCode } from "../types";

const base: Record<LocaleCode, Copy> = { en, ar, es, pt_BR, fr, de, ja, hi };
export const copies = Object.fromEntries(
  Object.entries(base).map(([locale, copy]) => [
    locale,
    {
      ...copy,
      features: [...copy.features, focus[locale as LocaleCode]],
    },
  ]),
) as Record<LocaleCode, Copy>;
