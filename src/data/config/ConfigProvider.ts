import { ConfigResolutionPipeline } from './ConfigResolutionPipeline';
import type { ConfigResolutionPipelineDeps } from './ConfigResolutionPipeline';
import type { ConfigLoadRequest } from '../../domain/models/ConfigDocument';
import type { IConfigProvider } from '../../domain/ports/IConfigProvider';
import type { Unsubscribe } from '../../domain/ports/IPlatformBridge';
import type {
  ResolvedVersionManagerConfig,
  VersionManagerOptions,
} from '../../domain/models/VersionManagerOptions';

export interface ConfigProviderDeps extends ConfigResolutionPipelineDeps {
  /** Background remote-refresh cadence for subscribe() (doc 03 §4.4). 0/undefined disables polling — resolve() still works. */
  readonly refreshIntervalMs?: number;
}

/**
 * IConfigProvider adapter around ConfigResolutionPipeline — resolve()/load() delegate
 * straight through, and subscribe() adds the doc 03 §4.4 "hot-update" behavior the raw
 * pipeline doesn't provide on its own: a background poll that re-runs resolution and
 * notifies listeners only when the resolved config actually changed.
 */
export class ConfigProvider implements IConfigProvider {
  private readonly pipeline: ConfigResolutionPipeline;
  private readonly refreshIntervalMs: number;
  private readonly listeners = new Set<
    (config: ResolvedVersionManagerConfig) => void
  >();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastConfig: ResolvedVersionManagerConfig | null = null;
  private lastOptions: VersionManagerOptions | null = null;

  constructor(deps: ConfigProviderDeps) {
    this.pipeline = new ConfigResolutionPipeline(deps);
    this.refreshIntervalMs = deps.refreshIntervalMs ?? 0;
  }

  async resolve(
    defaults: VersionManagerOptions
  ): Promise<ResolvedVersionManagerConfig> {
    this.lastOptions = defaults;
    const { config } = await this.pipeline.resolve(defaults);
    this.lastConfig = config;
    return config;
  }

  load(request: ConfigLoadRequest): Promise<ResolvedVersionManagerConfig> {
    return this.resolve(request.defaults);
  }

  subscribe(
    listener: (config: ResolvedVersionManagerConfig) => void
  ): Unsubscribe {
    this.listeners.add(listener);
    this.ensurePolling();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }

  private ensurePolling(): void {
    if (this.timer || this.refreshIntervalMs <= 0 || !this.lastOptions) return;
    this.timer = setInterval(() => {
      void this.refresh();
    }, this.refreshIntervalMs);
  }

  private async refresh(): Promise<void> {
    if (!this.lastOptions) return;
    // A background poll tick must never surface as an unhandled rejection — the
    // pipeline already reports validation/network failures via its own onError hook.
    const result = await this.pipeline
      .resolve(this.lastOptions)
      .catch(() => null);
    if (!result) return;
    if (JSON.stringify(result.config) === JSON.stringify(this.lastConfig))
      return;
    this.lastConfig = result.config;
    for (const listener of this.listeners) listener(result.config);
  }
}
