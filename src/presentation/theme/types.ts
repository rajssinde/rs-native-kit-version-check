// Theming (doc 06 §4) — a `theme` prop on the three prebuilt components, resolved
// against the OS color scheme via useColorScheme(). Presentation-layer only: no domain
// model depends on this, and omitting `theme` keeps every existing call site's exact
// prior look (the 'default' palette is the pre-theming claymorphism style, unchanged).

export type ThemeName = 'default' | 'appleStyle' | 'material3' | 'minimal';
export type ColorScheme = 'light' | 'dark';

/**
 * Color/shape tokens the three prebuilt components render from, instead of each
 * hardcoding its own StyleSheet constants. `neumorphic` toggles the raised/inset
 * double-border-plus-shadow technique the original 'default' theme used — the other
 * three themes render flat (a plain background + a single soft shadow) since a
 * neumorphic look is specific to that one style, not a universal theme axis.
 */
export interface ThemePalette {
  readonly name: ThemeName;
  readonly scheme: ColorScheme;
  readonly neumorphic: boolean;
  readonly backdrop: string;
  readonly surface: string;
  readonly surfaceRecessed: string;
  readonly highlightBorder: string;
  readonly shadowBorder: string;
  readonly text: string;
  readonly textMuted: string;
  readonly onPrimary: string;
  readonly onSecondary: string;
  readonly primary: string;
  readonly primaryPressed: string;
  readonly primaryShadow: string;
  readonly secondary: string;
  readonly secondaryShadow: string;
  readonly info: string;
  readonly infoShadow: string;
  readonly cardShadow: string;
  readonly radius: { readonly card: number; readonly button: number };
}
