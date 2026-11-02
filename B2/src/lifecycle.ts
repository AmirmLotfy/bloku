import type { Locale } from './model';

const WELCOME_KEY = 'blokuWelcomeV2';

export function lifecycleUrl(locale: Locale, page: 'hey' | 'bye'): string {
  let localePath: string;
  switch (locale) {
    case 'en': localePath = ''; break;
    case 'pt_BR': localePath = 'pt-br/'; break;
    case 'ar':
    case 'es':
    case 'fr':
    case 'de':
    case 'ja':
    case 'hi': localePath = `${locale}/`; break;
    default: throw new RangeError('Unsupported lifecycle locale');
  }
  if (page !== 'hey' && page !== 'bye') throw new RangeError('Unsupported lifecycle page');
  return `https://bloku.app/${localePath}${page}`;
}

export async function openWelcomeOnce(
  reason: string,
  locale: Locale,
  storage: {
    get(keys: string | string[]): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
  },
  open: (url: string) => Promise<unknown>,
): Promise<boolean> {
  if (reason !== 'install') return false;
  if ((await storage.get(WELCOME_KEY))[WELCOME_KEY] === true) return false;
  const url = lifecycleUrl(locale, 'hey');
  // Persist before opening so a failed tab creation cannot repeat on worker wake.
  await storage.set({ [WELCOME_KEY]: true });
  await open(url);
  return true;
}
