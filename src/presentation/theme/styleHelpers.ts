import { Platform } from 'react-native';
import type { ThemePalette } from './types';

interface ShadowOpts {
  offset?: { width: number; height: number };
  opacity?: number;
  radius?: number;
  elevation?: number;
}

export function elevationShadow(color: string, opts: ShadowOpts = {}) {
  const {
    offset = { width: 0, height: 2 },
    opacity = 0.3,
    radius = 8,
    elevation = 4,
  } = opts;
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: offset,
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    default: { elevation },
  });
}

/** A raised, colored surface (icon badges, primary buttons) — neumorphic shadow when the theme calls for it, a plain soft shadow otherwise. */
export function raisedSurface(
  palette: ThemePalette,
  backgroundColor: string,
  shadowColor: string,
  opts?: ShadowOpts
) {
  return {
    backgroundColor,
    ...elevationShadow(
      palette.neumorphic ? shadowColor : palette.cardShadow,
      opts
    ),
  };
}

/** An indented surface (version chips, secondary buttons) — double-border neumorphic inset, or a plain fill. */
export function insetBorder(palette: ThemePalette) {
  if (!palette.neumorphic) {
    return { backgroundColor: palette.surfaceRecessed };
  }
  return {
    backgroundColor: palette.surfaceRecessed,
    borderWidth: 1,
    borderTopColor: palette.shadowBorder,
    borderLeftColor: palette.shadowBorder,
    borderBottomColor: palette.highlightBorder,
    borderRightColor: palette.highlightBorder,
  };
}

/** An embossed outer surface (the banner card) — inverse border direction of insetBorder. */
export function raisedBorder(
  palette: ThemePalette,
  shadowColor: string,
  opts?: ShadowOpts
) {
  if (!palette.neumorphic) {
    return {
      backgroundColor: palette.surface,
      ...elevationShadow(palette.cardShadow, opts),
    };
  }
  return {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderTopColor: palette.highlightBorder,
    borderLeftColor: palette.highlightBorder,
    borderBottomColor: palette.shadowBorder,
    borderRightColor: palette.shadowBorder,
    ...elevationShadow(shadowColor, opts),
  };
}
