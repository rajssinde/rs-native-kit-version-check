import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import type { ActionPlan } from '../../domain/models/ActionPlan';
import type { LifecycleState } from '../../domain/models/LifecycleState';
import type { UpdateInfo } from '../../domain/models/UpdateInfo';
import { VersionManager } from '../../publicApi';
import { VersionManagerStore } from '../state/VersionManagerStore';
import { VersionManagerContext } from './context';

export interface UseUpdateStateResult {
  readonly state: LifecycleState;
  readonly updateInfo: UpdateInfo | null;
  readonly isUpdateAvailable: boolean;
  readonly actionPlan: ActionPlan | null;
}

/**
 * Reactive state only, for components that don't need to trigger checks (Prompt 2 §6).
 * Must be used beneath a tree where useVersionManager() or VersionManagerProvider has
 * already run at least once — otherwise this falls back to VersionManager.getInstance(),
 * which throws NotInitializedException if configure() was never called.
 */
export function useUpdateState(): UseUpdateStateResult {
  const contextManager = useContext(VersionManagerContext);
  const manager = useMemo(
    () => contextManager ?? VersionManager.getInstance(),
    [contextManager]
  );

  const store = useMemo(() => new VersionManagerStore(manager), [manager]);
  useEffect(() => () => store.dispose(), [store]);

  const uiState = useSyncExternalStore(
    useCallback((listener) => store.subscribe(listener), [store]),
    () => store.getState(),
    () => store.getState()
  );

  return {
    state: uiState.lifecycleState,
    updateInfo: uiState.updateInfo,
    isUpdateAvailable: uiState.isUpdateAvailable,
    actionPlan: uiState.actionPlan,
  };
}
