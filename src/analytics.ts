// Analytics entry point (doc 06 §5) — thin fan-out over the already-public event
// surface (IVersionManagerEvents / VersionManagerEventMap). Separate subpath (not
// reachable from src/index.tsx) purely for API discoverability, matching ./ui and
// ./background — this module has no react-native import and no bundle-size cost, so
// nothing strictly requires the split, but it keeps the core entry point's public
// surface focused on the manager itself.

import type { IVersionManagerEvents } from './domain/IVersionManagerCore';
import type {
  VersionManagerEventMap,
  VersionManagerEventType,
} from './domain/models/Events';
import type { Unsubscribe } from './domain/models/Unsubscribe';

const EVENT_TYPES: readonly VersionManagerEventType[] = [
  'stateChanged',
  'updateDetected',
  'updateNotAvailable',
  'userAction',
  'error',
];

export type AnalyticsSink = <K extends VersionManagerEventType>(
  event: K,
  payload: VersionManagerEventMap[K]
) => void;

/**
 * Subscribes `sink` to every VersionManagerEventMap event, so a consumer never has to
 * enumerate `on*` handlers by hand to wire up telemetry. This carries no opinion about
 * *where* events go — pass a sink that calls your own already-instantiated analytics
 * SDK (Mixpanel, Firebase, Datadog, ...); this library never imports those SDKs itself
 * (CLAUDE.md's single-dependency rule), it only forwards events you already have typed
 * access to via IVersionManagerEvents.
 */
export function subscribeAnalytics(
  manager: IVersionManagerEvents,
  sink: AnalyticsSink
): Unsubscribe {
  const unsubscribes = EVENT_TYPES.map((type) =>
    manager.on(type, (payload) => sink(type, payload))
  );

  return () => {
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
  };
}

/** Fans one event out to multiple sinks, e.g. `AnalyticsAdapter.combine(mixpanelSink, ddSink)`. */
function combine(...sinks: readonly AnalyticsSink[]): AnalyticsSink {
  return (event, payload) => {
    for (const sink of sinks) {
      sink(event, payload);
    }
  };
}

export const AnalyticsAdapter = { combine };
