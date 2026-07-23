import type { Unsubscribe } from '../../domain/models/Unsubscribe';

export type { Unsubscribe };

export interface IEventBus<TMap extends object> {
  publish<K extends keyof TMap>(type: K, payload: TMap[K]): void;
  subscribe<K extends keyof TMap>(
    type: K,
    handler: (payload: TMap[K]) => void
  ): Unsubscribe;
  /** Removes a handler registered via subscribe() by reference (Prompt 2 §4.2's off()). */
  off<K extends keyof TMap>(type: K, handler: (payload: TMap[K]) => void): void;
}

type AnyHandler = (payload: unknown) => void;

/**
 * Generic typed pub/sub used for both the internal domain event flow (Prompt 1 §6)
 * and the public IVersionManagerEvents surface (Prompt 2 §4). Copy-on-write listener
 * snapshots on dispatch (Prompt 1 §9.2) — publishing during a concurrent
 * subscribe/unsubscribe never races or throws.
 */
export class EventBus<TMap extends object> implements IEventBus<TMap> {
  private readonly listeners = new Map<keyof TMap, Set<AnyHandler>>();

  publish<K extends keyof TMap>(type: K, payload: TMap[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const handler of Array.from(set)) {
      handler(payload);
    }
  }

  subscribe<K extends keyof TMap>(
    type: K,
    handler: (payload: TMap[K]) => void
  ): Unsubscribe {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    const wrapped = handler as AnyHandler;
    set.add(wrapped);
    return () => {
      set?.delete(wrapped);
    };
  }

  off<K extends keyof TMap>(
    type: K,
    handler: (payload: TMap[K]) => void
  ): void {
    this.listeners.get(type)?.delete(handler as AnyHandler);
  }
}
