import { describe, expect, it, jest } from '@jest/globals';
import { EventBus } from '../../shared/eventbus/EventBus';

interface TestEventMap {
  ping: { count: number };
  other: { count: number };
}

describe('EventBus', () => {
  it('delivers a published payload to subscribers of that type only', () => {
    const bus = new EventBus<TestEventMap>();
    const pingHandler = jest.fn();
    const otherHandler = jest.fn();
    bus.subscribe('ping', pingHandler);
    bus.subscribe('other', otherHandler);

    bus.publish('ping', { count: 1 });

    expect(pingHandler).toHaveBeenCalledWith({ count: 1 });
    expect(otherHandler).not.toHaveBeenCalled();
  });

  it('stops notifying a handler after it unsubscribes', () => {
    const bus = new EventBus<TestEventMap>();
    const handler = jest.fn();
    const unsubscribe = bus.subscribe('ping', handler);
    unsubscribe();

    bus.publish('ping', { count: 1 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('allows a handler to unsubscribe itself mid-dispatch without affecting the current publish', () => {
    const bus = new EventBus<TestEventMap>();
    let unsubscribe: () => void = () => {};
    const handler = jest.fn(() => unsubscribe());
    unsubscribe = bus.subscribe('ping', handler);

    expect(() => bus.publish('ping', { count: 1 })).not.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);

    bus.publish('ping', { count: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
