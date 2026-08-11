import type {
  IInAppUpdateProvider,
  InAppUpdateFlow,
} from '../ports/IInAppUpdateProvider';

export interface TriggerInAppUpdateInput {
  readonly flow: InAppUpdateFlow;
  readonly storeUrl: string | null;
}

export type TriggerInAppUpdateResult =
  | { readonly outcome: 'started'; readonly flow: InAppUpdateFlow }
  | { readonly outcome: 'unavailable' }
  /** No IInAppUpdateProvider on the active IPlatformBridge (e.g. Web) — caller should fall back to opening storeUrl. */
  | { readonly outcome: 'unsupported' };

/**
 * Doc 04 §1 — decides nothing about *which* flow to use (that's the caller's call,
 * usually derived from ActionType — FORCE_UPDATE -> immediate, SOFT_UPDATE -> flexible;
 * see VersionManagerCore.triggerInAppUpdate()); this use case only orchestrates
 * "check, then start" against whatever IInAppUpdateProvider the platform bridge has.
 */
export class TriggerInAppUpdateUseCase {
  constructor(private readonly provider: IInAppUpdateProvider | undefined) {}

  async execute(
    input: TriggerInAppUpdateInput
  ): Promise<TriggerInAppUpdateResult> {
    if (!this.provider) {
      return { outcome: 'unsupported' };
    }

    const status = await this.provider.checkAvailability();
    if (status.availability !== 'available') {
      return { outcome: 'unavailable' };
    }

    await this.provider.startUpdate(input.flow, input.storeUrl ?? '');
    return { outcome: 'started', flow: input.flow };
  }
}
