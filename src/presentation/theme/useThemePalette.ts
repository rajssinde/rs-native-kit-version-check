import { useColorScheme } from 'react-native';
import { getThemePalette } from './palettes';
import type { ThemeName, ThemePalette } from './types';

/** Resolves a `theme` prop against the OS color scheme. Defaults to 'default'/light when useColorScheme() returns null (no OS preference available, e.g. some Web contexts). */
export function useThemePalette(theme: ThemeName = 'default'): ThemePalette {
  const scheme = useColorScheme();
  return getThemePalette(theme, scheme === 'dark' ? 'dark' : 'light');
}
