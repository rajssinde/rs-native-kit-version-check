import type { VersionManagerException } from '../errors/VersionManagerException';
import type { ActionPlan } from './ActionPlan';
import type { LifecycleState } from './LifecycleState';
import type { UpdateInfo } from './UpdateInfo';

export interface StateChangedEvent {
  readonly from: LifecycleState;
  readonly to: LifecycleState;
  readonly timestamp: number;
}

export interface UpdateDetectedEvent {
  readonly updateInfo: UpdateInfo;
  readonly actionPlan: ActionPlan;
  readonly timestamp: number;
}

export interface UpdateNotAvailableEvent {
  readonly currentVersion: string;
  readonly checkedAt: number;
}

export type UserActionType =
  'update_clicked' | 'later_clicked' | 'ignore_clicked' | 'dismiss_clicked';

export interface UserActionEvent {
  readonly action: UserActionType;
  readonly updateInfo: UpdateInfo;
  readonly timestamp: number;
}

export type ErrorPhase = 'config' | 'check' | 'policy' | 'presentation';

export interface VersionManagerErrorEvent {
  readonly error: VersionManagerException;
  readonly phase: ErrorPhase;
  readonly timestamp: number;
}

export interface VersionManagerEventMap {
  stateChanged: StateChangedEvent;
  updateDetected: UpdateDetectedEvent;
  updateNotAvailable: UpdateNotAvailableEvent;
  userAction: UserActionEvent;
  error: VersionManagerErrorEvent;
}

export type VersionManagerEventType = keyof VersionManagerEventMap;
