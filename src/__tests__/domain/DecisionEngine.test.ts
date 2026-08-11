import { describe, expect, it } from '@jest/globals';
import { ActionType } from '../../domain/models/ActionPlan';
import { DecisionEngine } from '../../domain/engines/decision/DecisionEngine';
import type { RemoteVersionInfo } from '../../domain/models/RemoteVersionInfo';
import { MockClock } from '../mocks/MockClock';

function remote(overrides: Partial<RemoteVersionInfo> = {}): RemoteVersionInfo {
  return {
    latestVersion: '2.0.0',
    storeUrl: 'https://example.com/app',
    releaseNotes: null,
    minimumOsVersion: null,
    fetchedAt: 0,
    provider: 'custom',
    updateChannel: null,
    ...overrides,
  };
}

describe('DecisionEngine recommendedChannel (doc 06 §2)', () => {
  it('defaults UpdateInfo.recommendedChannel to "binary" when the remote signal asserted nothing', () => {
    const engine = new DecisionEngine(new MockClock(0));

    const plan = engine.buildActionPlan(
      ActionType.SOFT_UPDATE,
      '1.0.0',
      remote({ updateChannel: null })
    );

    expect(plan.updateInfo?.recommendedChannel).toBe('binary');
  });

  it('passes through a remote-asserted "ota" channel', () => {
    const engine = new DecisionEngine(new MockClock(0));

    const plan = engine.buildActionPlan(
      ActionType.SOFT_UPDATE,
      '1.0.0',
      remote({ updateChannel: 'ota' })
    );

    expect(plan.updateInfo?.recommendedChannel).toBe('ota');
  });
});
