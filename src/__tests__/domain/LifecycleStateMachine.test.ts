import { describe, expect, it, jest } from '@jest/globals';
import { LifecycleState } from '../../domain/models/LifecycleState';
import {
  InvalidTransitionError,
  LifecycleStateMachine,
} from '../../domain/statemachine/LifecycleStateMachine';

describe('LifecycleStateMachine', () => {
  it('starts in UNINITIALIZED', () => {
    expect(new LifecycleStateMachine().current).toBe(
      LifecycleState.UNINITIALIZED
    );
  });

  it('follows the documented happy-path transitions', () => {
    const sm = new LifecycleStateMachine();
    sm.transition(LifecycleState.CONFIG_LOADING);
    sm.transition(LifecycleState.IDLE);
    sm.transition(LifecycleState.VERSION_CHECKING);
    sm.transition(LifecycleState.DECIDING);
    sm.transition(LifecycleState.FORCE_UPDATE_DISPLAYED);
    expect(sm.current).toBe(LifecycleState.FORCE_UPDATE_DISPLAYED);
  });

  it('rejects a transition with no modeled edge', () => {
    const sm = new LifecycleStateMachine();
    expect(() => sm.transition(LifecycleState.DECIDING)).toThrow(
      InvalidTransitionError
    );
  });

  it('notifies onEnter/onExit handlers in copy-on-write fashion', () => {
    const sm = new LifecycleStateMachine();
    const onEnter = jest.fn();
    const onExit = jest.fn();
    sm.onEnter(LifecycleState.CONFIG_LOADING, onEnter);
    sm.onExit(LifecycleState.UNINITIALIZED, onExit);

    sm.transition(LifecycleState.CONFIG_LOADING);

    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('lets a handler unsubscribe itself mid-dispatch without throwing', () => {
    const sm = new LifecycleStateMachine();
    let unsubscribe: () => void = () => {};
    const handler = jest.fn(() => unsubscribe());
    unsubscribe = sm.onEnter(LifecycleState.CONFIG_LOADING, handler);

    expect(() => sm.transition(LifecycleState.CONFIG_LOADING)).not.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
