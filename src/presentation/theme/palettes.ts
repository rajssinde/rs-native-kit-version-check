import type { ColorScheme, ThemeName, ThemePalette } from './types';

/**
 * 'default' is the original, pre-theming claymorphism look (same literal color values
 * ForceUpdateScreen/SoftUpdateDialog/OptionalUpdateBanner hardcoded before theming
 * existed) — its light variant must render pixel-identical to the pre-theming output.
 */
const DEFAULT_LIGHT: ThemePalette = {
  name: 'default',
  scheme: 'light',
  neumorphic: true,
  backdrop: 'rgba(58,42,30,0.55)',
  surface: '#FFEBD3',
  surfaceRecessed: '#F3DAB9',
  highlightBorder: 'rgba(255,255,255,0.9)',
  shadowBorder: 'rgba(196,150,102,0.45)',
  text: '#4A362B',
  textMuted: '#9C8570',
  onPrimary: '#ffffff',
  onSecondary: '#1f4a3d',
  primary: '#FFB6A6',
  primaryPressed: '#F29A87',
  primaryShadow: '#e08a72',
  secondary: '#9BCEC1',
  secondaryShadow: '#6ea393',
  info: '#67A2C5',
  infoShadow: '#4f7f9c',
  cardShadow: '#c9a97c',
  radius: { card: 28, button: 16 },
};

const DEFAULT_DARK: ThemePalette = {
  ...DEFAULT_LIGHT,
  scheme: 'dark',
  backdrop: 'rgba(0,0,0,0.65)',
  surface: '#2B211A',
  surfaceRecessed: '#241B15',
  highlightBorder: 'rgba(255,255,255,0.08)',
  shadowBorder: 'rgba(0,0,0,0.55)',
  text: '#F3E4D3',
  textMuted: '#B79C82',
  onSecondary: '#0F2A22',
  primary: '#E08A72',
  primaryPressed: '#C97457',
  cardShadow: 'rgba(0,0,0,0.6)',
};

const APPLE_LIGHT: ThemePalette = {
  name: 'appleStyle',
  scheme: 'light',
  neumorphic: false,
  backdrop: 'rgba(0,0,0,0.4)',
  surface: '#FFFFFF',
  surfaceRecessed: '#F2F2F7',
  highlightBorder: 'transparent',
  shadowBorder: 'rgba(60,60,67,0.1)',
  text: '#1C1C1E',
  textMuted: '#8E8E93',
  onPrimary: '#FFFFFF',
  onSecondary: '#FFFFFF',
  primary: '#007AFF',
  primaryPressed: '#0060DF',
  primaryShadow: 'rgba(0,122,255,0.3)',
  secondary: '#34C759',
  secondaryShadow: 'rgba(52,199,89,0.3)',
  info: '#5AC8FA',
  infoShadow: 'rgba(90,200,250,0.3)',
  cardShadow: 'rgba(0,0,0,0.15)',
  radius: { card: 20, button: 14 },
};

const APPLE_DARK: ThemePalette = {
  ...APPLE_LIGHT,
  scheme: 'dark',
  backdrop: 'rgba(0,0,0,0.6)',
  surface: '#1C1C1E',
  surfaceRecessed: '#2C2C2E',
  shadowBorder: 'rgba(255,255,255,0.08)',
  text: '#FFFFFF',
  onSecondary: '#000000',
  primary: '#0A84FF',
  primaryPressed: '#409CFF',
  secondary: '#30D158',
  info: '#64D2FF',
  cardShadow: 'rgba(0,0,0,0.5)',
};

const MATERIAL3_LIGHT: ThemePalette = {
  name: 'material3',
  scheme: 'light',
  neumorphic: false,
  backdrop: 'rgba(0,0,0,0.4)',
  surface: '#FFFBFE',
  surfaceRecessed: '#E7E0EC',
  highlightBorder: 'transparent',
  shadowBorder: 'rgba(0,0,0,0.08)',
  text: '#1C1B1F',
  textMuted: '#49454F',
  onPrimary: '#FFFFFF',
  onSecondary: '#FFFFFF',
  primary: '#6750A4',
  primaryPressed: '#54408F',
  primaryShadow: 'rgba(103,80,164,0.3)',
  secondary: '#625B71',
  secondaryShadow: 'rgba(98,91,113,0.3)',
  info: '#7D5260',
  infoShadow: 'rgba(125,82,96,0.3)',
  cardShadow: 'rgba(0,0,0,0.15)',
  radius: { card: 24, button: 20 },
};

const MATERIAL3_DARK: ThemePalette = {
  ...MATERIAL3_LIGHT,
  scheme: 'dark',
  backdrop: 'rgba(0,0,0,0.6)',
  surface: '#1C1B1F',
  surfaceRecessed: '#49454F',
  shadowBorder: 'rgba(255,255,255,0.08)',
  text: '#E6E1E5',
  textMuted: '#CAC4D0',
  onPrimary: '#381E72',
  onSecondary: '#332D41',
  primary: '#D0BCFF',
  primaryPressed: '#B69DF8',
  secondary: '#CCC2DC',
  info: '#EFB8C8',
  cardShadow: 'rgba(0,0,0,0.5)',
};

const MINIMAL_LIGHT: ThemePalette = {
  name: 'minimal',
  scheme: 'light',
  neumorphic: false,
  backdrop: 'rgba(0,0,0,0.35)',
  surface: '#FFFFFF',
  surfaceRecessed: '#F5F5F5',
  highlightBorder: 'transparent',
  shadowBorder: 'rgba(0,0,0,0.06)',
  text: '#111111',
  textMuted: '#6B6B6B',
  onPrimary: '#FFFFFF',
  onSecondary: '#FFFFFF',
  primary: '#111111',
  primaryPressed: '#333333',
  primaryShadow: 'rgba(0,0,0,0.2)',
  secondary: '#111111',
  secondaryShadow: 'rgba(0,0,0,0.15)',
  info: '#111111',
  infoShadow: 'rgba(0,0,0,0.15)',
  cardShadow: 'rgba(0,0,0,0.1)',
  radius: { card: 16, button: 12 },
};

/** Glassmorphism variant of 'minimal' in dark mode — translucent surfaces over a dimmed backdrop. */
const MINIMAL_DARK: ThemePalette = {
  ...MINIMAL_LIGHT,
  scheme: 'dark',
  backdrop: 'rgba(0,0,0,0.6)',
  surface: 'rgba(255,255,255,0.08)',
  surfaceRecessed: 'rgba(255,255,255,0.14)',
  shadowBorder: 'rgba(255,255,255,0.12)',
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.6)',
  onPrimary: '#111111',
  onSecondary: '#111111',
  primary: '#FFFFFF',
  primaryPressed: '#E0E0E0',
  primaryShadow: 'rgba(255,255,255,0.15)',
  secondary: '#FFFFFF',
  secondaryShadow: 'rgba(255,255,255,0.1)',
  info: '#FFFFFF',
  infoShadow: 'rgba(255,255,255,0.1)',
  cardShadow: 'rgba(0,0,0,0.5)',
};

const THEMES: Record<ThemeName, Record<ColorScheme, ThemePalette>> = {
  default: { light: DEFAULT_LIGHT, dark: DEFAULT_DARK },
  appleStyle: { light: APPLE_LIGHT, dark: APPLE_DARK },
  material3: { light: MATERIAL3_LIGHT, dark: MATERIAL3_DARK },
  minimal: { light: MINIMAL_LIGHT, dark: MINIMAL_DARK },
};

export function getThemePalette(
  theme: ThemeName,
  scheme: ColorScheme
): ThemePalette {
  return THEMES[theme][scheme];
}
