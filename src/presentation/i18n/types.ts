// Localization (doc 06 §4) — default copy for the three prebuilt components, resolved
// against the device locale. This is the code path only; translation *content* is
// ongoing best-effort work (see locales.ts), not a closed/exhaustive set — every string
// stays overridable per-component-instance via existing props (title/message/...),
// exactly as before localization existed.

export interface ForceUpdateStrings {
  readonly title: string;
  readonly message: (latestVersion: string) => string;
  readonly updateButtonLabel: string;
}

export interface SoftUpdateStrings {
  readonly title: string;
  readonly message: (
    latestVersion: string,
    releaseNotes: string | null
  ) => string;
  readonly updateButtonLabel: string;
  readonly laterButtonLabel: string;
}

export interface OptionalBannerStrings {
  readonly message: (latestVersion: string) => string;
  readonly updateButtonLabel: string;
}

export interface LocaleStrings {
  readonly forceUpdate: ForceUpdateStrings;
  readonly softUpdate: SoftUpdateStrings;
  readonly optionalBanner: OptionalBannerStrings;
}

/**
 * Base language codes with a translated bundle (see locales.ts). Not an exhaustive list
 * of every locale a device can report — resolveLocaleStrings() falls back to 'en' for
 * anything not in this set.
 */
export type LocaleCode =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pt'
  | 'ja'
  | 'zh'
  | 'ko'
  | 'hi'
  | 'ar'
  | 'ru';
