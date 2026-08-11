import { describe, expect, it, jest } from '@jest/globals';
import { AnalyticsAdapter, subscribeAnalytics } from '../../analytics';
import type { IVersionManagerEvents } from '../../domain/IVersionManagerCore';
import { ActionType } from '../../domain/models/ActionPlan';
import type { VersionManagerEventMap } from '../../domain/models/Events';
import { LifecycleState } from '../../domain/models/LifecycleState';
import { EventBus } from '../../shared/eventbus/EventBus';

function createFakeManager(): {
  manager: IVersionManagerEvents;
  bus: EventBus<VersionManagerEventMap>;
} {
  const bus = new EventBus<VersionManagerEventMap>();
  const manager: IVersionManagerEvents = {
    on: (event, handler) => bus.subscribe(event, handler),
    once: (event, handler) => {
      const unsubscribe = bus.subscribe(event, (payload) => {
        unsubscribe();
        handler(payload);
      });
      return unsubscribe;
    },
    off: (event, handler) => bus.off(event, handler),
    onUpdateDetected: (handler) => bus.subscribe('updateDetected', handler),
    onUserAction: (handler) => bus.subscribe('userAction', handler),
    onError: (handler) => bus.subscribe('error', handler),
    onStateChanged: (handler) => bus.subscribe('stateChanged', handler),
  };
  return { manager, bus };
}

describe('subscribeAnalytics', () => {
  it('forwards every VersionManagerEventMap event type to the sink, without hand-wiring each on* handler', () => {
    const { manager, bus } = createFakeManager();
    const sink = jest.fn();
    subscribeAnalytics(manager, sink);

    const stateChanged = {
      from: LifecycleState.IDLE,
      to: LifecycleState.VERSION_CHECKING,
      timestamp: 1,
    };
    bus.publish('stateChanged', stateChanged);
    expect(sink).toHaveBeenCalledWith('stateChanged', stateChanged);

    const updateDetected = {
      updateInfo: {
        currentVersion: '1.0.0',
        latestVersion: '1.1.0',
        storeUrl: 'https://example.com/app',
        releaseNotes: null,
        isForceUpdate: false,
        provider: 'apple' as const,
        fetchedAt: 2,
        recommendedChannel: 'binary' as const,
      },
      actionPlan: {
        type: ActionType.SOFT_UPDATE,
        updateInfo: null,
        reason: 'below floor',
        decidedAt: 2,
      },
      timestamp: 2,
    };
    bus.publish('updateDetected', updateDetected);
    expect(sink).toHaveBeenCalledWith('updateDetected', updateDetected);

    const userAction = {
      action: 'update_clicked' as const,
      updateInfo: updateDetected.updateInfo,
      timestamp: 3,
    };
    bus.publish('userAction', userAction);
    expect(sink).toHaveBeenCalledWith('userAction', userAction);

    expect(sink).toHaveBeenCalledTimes(3);
  });

  it('stops forwarding once the returned unsubscribe is called', () => {
    const { manager, bus } = createFakeManager();
    const sink = jest.fn();
    const unsubscribe = subscribeAnalytics(manager, sink);

    unsubscribe();
    bus.publish('stateChanged', {
      from: LifecycleState.IDLE,
      to: LifecycleState.VERSION_CHECKING,
      timestamp: 1,
    });

    expect(sink).not.toHaveBeenCalled();
  });
});

describe('AnalyticsAdapter.combine', () => {
  it('fans one event out to every sink, in order', () => {
    const calls: string[] = [];
    const first = jest.fn(() => calls.push('first'));
    const second = jest.fn(() => calls.push('second'));
    const combined = AnalyticsAdapter.combine(first, second);

    combined('updateNotAvailable', { currentVersion: '1.0.0', checkedAt: 1 });

    expect(first).toHaveBeenCalledWith('updateNotAvailable', {
      currentVersion: '1.0.0',
      checkedAt: 1,
    });
    expect(second).toHaveBeenCalledWith('updateNotAvailable', {
      currentVersion: '1.0.0',
      checkedAt: 1,
    });
    expect(calls).toEqual(['first', 'second']);
  });

  it('is a safe no-op with zero sinks', () => {
    const combined = AnalyticsAdapter.combine();
    expect(() =>
      combined('updateNotAvailable', { currentVersion: '1.0.0', checkedAt: 1 })
    ).not.toThrow();
  });
});
