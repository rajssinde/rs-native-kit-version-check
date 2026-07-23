import {
  LIFECYCLE_TRANSITIONS,
  LifecycleState,
} from '../models/LifecycleState';
import type { Unsubscribe } from '../models/Unsubscribe';

/** Internal invariant violation — not part of the public VersionManagerException hierarchy. */
export class InvalidTransitionError extends Error {
  constructor(from: LifecycleState, to: LifecycleState) {
    super(`Invalid lifecycle transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export interface ILifecycleStateMachine {
  readonly current: LifecycleState;
  transition(to: LifecycleState): void;
  onEnter(state: LifecycleState, handler: () => void): Unsubscribe;
  onExit(state: LifecycleState, handler: () => void): Unsubscribe;
}

type HandlerMap = Map<LifecycleState, Set<() => void>>;

export class LifecycleStateMachine implements ILifecycleStateMachine {
  private state: LifecycleState = LifecycleState.UNINITIALIZED;
  private readonly enterHandlers: HandlerMap = new Map();
  private readonly exitHandlers: HandlerMap = new Map();

  get current(): LifecycleState {
    return this.state;
  }

  transition(to: LifecycleState): void {
    const allowed = LIFECYCLE_TRANSITIONS[this.state];
    if (!allowed.includes(to)) {
      throw new InvalidTransitionError(this.state, to);
    }
    const from = this.state;
    this.notify(this.exitHandlers, from);
    this.state = to;
    this.notify(this.enterHandlers, to);
  }

  onEnter(state: LifecycleState, handler: () => void): Unsubscribe {
    return this.register(this.enterHandlers, state, handler);
  }

  onExit(state: LifecycleState, handler: () => void): Unsubscribe {
    return this.register(this.exitHandlers, state, handler);
  }

  private register(
    map: HandlerMap,
    state: LifecycleState,
    handler: () => void
  ): Unsubscribe {
    let set = map.get(state);
    if (!set) {
      set = new Set();
      map.set(state, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }

  /** Copy-on-write snapshot dispatch (Prompt 1 §9.2) — safe if a handler unsubscribes mid-dispatch. */
  private notify(map: HandlerMap, state: LifecycleState): void {
    const set = map.get(state);
    if (!set) return;
    for (const handler of Array.from(set)) {
      handler();
    }
  }
}
