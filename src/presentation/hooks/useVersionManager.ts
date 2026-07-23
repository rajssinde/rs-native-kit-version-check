import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import type { IVersionManagerCore } from '../../domain/IVersionManagerCore';
import type { LifecycleState } from '../../domain/models/LifecycleState';
import type { ActionPlan } from '../../domain/models/ActionPlan';
import type { CheckForUpdatesOptions } from '../../domain/models/PublicApiOptions';
import type { UpdateInfo } from '../../domain/models/UpdateInfo';
import type { VersionManagerOptions } from '../../domain/models/VersionManagerOptions';
import { VersionManager } from '../../publicApi';
import { VersionManagerStore } from '../state/VersionManagerStore';
import { VersionManagerContext } from './context';

export interface UseVersionManagerResult {
  readonly manager: IVersionManagerCore;
  readonly state: LifecycleState;
  readonly updateInfo: UpdateInfo | null;
  readonly isUpdateAvailable: boolean;
  readonly checkForUpdates: (
    options?: CheckForUpdatesOptions
  ) => Promise<ActionPlan>;
}

/**
 * Bootstraps (or attaches to) the singleton and returns the imperative handle plus
 * reactive state in one call (Prompt 2 §6). For a stable manager reference across
 * re-renders, pass a memoized `options` object — VersionManager.configure() is
 * idempotent for equal options, but this hook still re-invokes it whenever the
 * `options` reference changes.
 */
export function useVersionManager(
  options?: VersionManagerOptions
): UseVersionManagerResult {
  const contextManager = useContext(VersionManagerContext);

  const manager = useMemo<IVersionManagerCore>(() => {
    if (contextManager) return contextManager;
    if (options) return VersionManager.configure(options);
    return VersionManager.getInstance();
  }, [contextManager, options]);

  const store = useMemo(() => new VersionManagerStore(manager), [manager]);
  useEffect(() => () => store.dispose(), [store]);

  const uiState = useSyncExternalStore(
    useCallback((listener) => store.subscribe(listener), [store]),
    () => store.getState(),
    () => store.getState()
  );

  const checkForUpdates = useCallback(
    (checkOptions?: CheckForUpdatesOptions) =>
      manager.checkForUpdates(checkOptions),
    [manager]
  );

  return {
    manager,
    state: uiState.lifecycleState,
    updateInfo: uiState.updateInfo,
    isUpdateAvailable: uiState.isUpdateAvailable,
    checkForUpdates,
  };
}
