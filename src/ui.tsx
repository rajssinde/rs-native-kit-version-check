// Presentation entry point (Prompt 1 §8) — importing only 'src/index.tsx' never pulls
// in anything below; this subpath is where React/RN UI code lives.

export { useVersionManager } from './presentation/hooks/useVersionManager';
export type { UseVersionManagerResult } from './presentation/hooks/useVersionManager';
export { useUpdateState } from './presentation/hooks/useUpdateState';
export type { UseUpdateStateResult } from './presentation/hooks/useUpdateState';
export { VersionManagerProvider } from './presentation/hooks/VersionManagerProvider';
export type { VersionManagerProviderProps } from './presentation/hooks/VersionManagerProvider';

export { ForceUpdateScreen } from './presentation/components/ForceUpdateScreen';
export type { ForceUpdateScreenProps } from './presentation/components/ForceUpdateScreen';
export { SoftUpdateDialog } from './presentation/components/SoftUpdateDialog';
export type { SoftUpdateDialogProps } from './presentation/components/SoftUpdateDialog';
export { OptionalUpdateBanner } from './presentation/components/OptionalUpdateBanner';
export type { OptionalUpdateBannerProps } from './presentation/components/OptionalUpdateBanner';

export type { VersionManagerUiState } from './presentation/state/VersionManagerStore';
export { VersionManagerStore } from './presentation/state/VersionManagerStore';

export type { ThemeName, ThemePalette } from './presentation/theme/types';

export type { LocaleCode, LocaleStrings } from './presentation/i18n/types';
export { resolveLocaleStrings } from './presentation/i18n/locales';
