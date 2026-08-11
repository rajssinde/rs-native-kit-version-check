import { resolveLocaleStrings } from './locales';
import type { LocaleStrings } from './types';

function detectLocale(): string {
  try {
    // Intl is a JS-engine builtin (Hermes/JSC/V8), not an RN native-bridge call — no
    // IPlatformBridge dependency needed here, unlike IAppInfoProvider/IDeviceInfoProvider.
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return 'en';
  }
}

/** Resolves default copy for the prebuilt components. Pass an explicit `locale` (e.g. from your own app-level language setting) to override device-locale auto-detection. */
export function useLocaleStrings(locale?: string): LocaleStrings {
  return resolveLocaleStrings(locale ?? detectLocale());
}
