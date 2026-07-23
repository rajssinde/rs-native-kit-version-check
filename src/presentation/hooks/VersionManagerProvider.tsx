import { useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { VersionManager } from '../../publicApi';
import type { VersionManagerOptions } from '../../domain/models/VersionManagerOptions';
import { VersionManagerContext } from './context';

export interface VersionManagerProviderProps {
  options: VersionManagerOptions;
  children: ReactNode;
}

/** Optional top-level configuration provider (Prompt 2 §6) — an alternative to passing options to every useVersionManager() call. */
export function VersionManagerProvider({
  options,
  children,
}: VersionManagerProviderProps): ReactElement {
  const manager = useMemo(() => VersionManager.configure(options), [options]);
  return (
    <VersionManagerContext.Provider value={manager}>
      {children}
    </VersionManagerContext.Provider>
  );
}
