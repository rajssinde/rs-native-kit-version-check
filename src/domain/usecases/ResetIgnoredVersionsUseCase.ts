import type { IVersionRepository } from '../ports/IVersionRepository';

export class ResetIgnoredVersionsUseCase {
  constructor(private readonly repository: IVersionRepository) {}

  async execute(versions?: readonly string[]): Promise<void> {
    const current = await this.repository.getUserDecision();
    const remindMeLaterUntil = current?.remindMeLaterUntil ?? null;

    if (!versions || versions.length === 0) {
      await this.repository.persistUserDecision({
        ignoredVersions: [],
        remindMeLaterUntil,
      });
      return;
    }

    const remaining = (current?.ignoredVersions ?? []).filter(
      (v) => !versions.includes(v)
    );
    await this.repository.persistUserDecision({
      ignoredVersions: remaining,
      remindMeLaterUntil,
    });
  }
}
