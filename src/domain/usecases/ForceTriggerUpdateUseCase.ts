import { ActionType } from '../models/ActionPlan';
import type { ActionPlan } from '../models/ActionPlan';
import type { DecisionEngine } from '../engines/decision/DecisionEngine';
import type { PlatformId } from '../models/PlatformId';
import type { IVersionRepository } from '../ports/IVersionRepository';

export interface ForceTriggerUpdateInput {
  readonly currentVersion: string;
  readonly bundleId: string;
  readonly platform: PlatformId;
  readonly timeoutMs: number;
}

export class ForceTriggerUpdateUseCase {
  constructor(
    private readonly repository: IVersionRepository,
    private readonly decisionEngine: DecisionEngine
  ) {}

  async execute(input: ForceTriggerUpdateInput): Promise<ActionPlan> {
    const remote = await this.repository.getRemoteVersionInfo({
      currentVersion: input.currentVersion,
      bundleId: input.bundleId,
      platform: input.platform,
      bypassCache: true,
      timeoutMs: input.timeoutMs,
    });

    return this.decisionEngine.buildActionPlan(
      ActionType.FORCE_UPDATE,
      input.currentVersion,
      remote
    );
  }
}
