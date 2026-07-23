export const LifecycleState = {
  UNINITIALIZED: 'UNINITIALIZED',
  CONFIG_LOADING: 'CONFIG_LOADING',
  IDLE: 'IDLE',
  VERSION_CHECKING: 'VERSION_CHECKING',
  DECIDING: 'DECIDING',
  FORCE_UPDATE_DISPLAYED: 'FORCE_UPDATE_DISPLAYED',
  SOFT_UPDATE_DISPLAYED: 'SOFT_UPDATE_DISPLAYED',
  REJECTED_WAITING_REMINDER: 'REJECTED_WAITING_REMINDER',
  TERMINATED: 'TERMINATED',
} as const;

export type LifecycleState =
  (typeof LifecycleState)[keyof typeof LifecycleState];

/**
 * Allowed transitions. Anything not listed here is invalid and
 * ILifecycleStateMachine.transition() must reject it.
 */
export const LIFECYCLE_TRANSITIONS: Readonly<
  Record<LifecycleState, readonly LifecycleState[]>
> = {
  UNINITIALIZED: [LifecycleState.CONFIG_LOADING],
  CONFIG_LOADING: [LifecycleState.IDLE, LifecycleState.TERMINATED],
  IDLE: [LifecycleState.VERSION_CHECKING, LifecycleState.TERMINATED],
  VERSION_CHECKING: [
    LifecycleState.DECIDING,
    LifecycleState.IDLE,
    LifecycleState.TERMINATED,
  ],
  DECIDING: [
    LifecycleState.FORCE_UPDATE_DISPLAYED,
    LifecycleState.SOFT_UPDATE_DISPLAYED,
    LifecycleState.REJECTED_WAITING_REMINDER,
    LifecycleState.IDLE,
    LifecycleState.TERMINATED,
  ],
  FORCE_UPDATE_DISPLAYED: [LifecycleState.TERMINATED],
  SOFT_UPDATE_DISPLAYED: [
    LifecycleState.IDLE,
    LifecycleState.REJECTED_WAITING_REMINDER,
    LifecycleState.TERMINATED,
  ],
  REJECTED_WAITING_REMINDER: [
    LifecycleState.IDLE,
    LifecycleState.VERSION_CHECKING,
    LifecycleState.TERMINATED,
  ],
  TERMINATED: [],
};
