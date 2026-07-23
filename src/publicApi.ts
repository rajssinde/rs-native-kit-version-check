import { createVersionManagerCore } from './di/container';
import {
  InvalidConfigException,
  NotInitializedException,
} from './domain/errors/VersionManagerException';
import type { IVersionManagerCore } from './domain/IVersionManagerCore';
import type {
  CacheOptions,
  FallbackOptions,
  LoggingOptions,
  PolicyOptions,
  StoreLinksOptions,
  VersionManagerOptions,
} from './domain/models/VersionManagerOptions';
import type { IPlatformBridge } from './domain/ports/IPlatformBridge';

let instance: IVersionManagerCore | null = null;
let instanceOptions: VersionManagerOptions | null = null;

/**
 * Structural equality via JSON serialization — good enough to detect "the same
 * configure() call happening twice" (e.g. duplicate provider mounts in React) without
 * requiring callers to memoize their options object. `platformBridge` (a live object
 * of functions) is excluded; DI overrides are expected to be stable references from
 * advanced/testing callers, not something this check needs to compare deeply.
 */
function withoutPlatformBridge(
  options: VersionManagerOptions
): Omit<VersionManagerOptions, 'platformBridge'> {
  const clone: VersionManagerOptions = { ...options };
  delete clone.platformBridge;
  return clone;
}

function optionsEqual(
  a: VersionManagerOptions,
  b: VersionManagerOptions
): boolean {
  return (
    JSON.stringify(withoutPlatformBridge(a)) ===
    JSON.stringify(withoutPlatformBridge(b))
  );
}

export const VersionManager = {
  configure(options: VersionManagerOptions): IVersionManagerCore {
    if (instance && instanceOptions) {
      if (optionsEqual(instanceOptions, options)) {
        return instance;
      }
      throw new InvalidConfigException({
        message:
          'VersionManager.configure() was already called with different options. Call VersionManager.reset() first if this is intentional (e.g. in tests).',
      });
    }
    const core = createVersionManagerCore(options);
    instance = core;
    instanceOptions = options;
    return core;
  },

  getInstance(): IVersionManagerCore {
    if (!instance) {
      throw new NotInitializedException({
        message: 'VersionManager.getInstance() called before configure()',
      });
    }
    return instance;
  },

  isConfigured(): boolean {
    return instance !== null;
  },

  /** Testing/HMR only — tears down the singleton (Prompt 2 §1.1). */
  reset(): void {
    instance?.dispose();
    instance = null;
    instanceOptions = null;
  },
};

export class VersionManagerBuilder {
  private options: VersionManagerOptions = { stores: {} };

  private constructor() {}

  static create(): VersionManagerBuilder {
    return new VersionManagerBuilder();
  }

  withLogging(options: LoggingOptions): this {
    this.options = { ...this.options, logging: options };
    return this;
  }

  withCache(options: CacheOptions): this {
    this.options = { ...this.options, cache: options };
    return this;
  }

  withFallback(options: FallbackOptions): this {
    this.options = { ...this.options, fallback: options };
    return this;
  }

  withStoreLinks(options: StoreLinksOptions): this {
    this.options = { ...this.options, stores: options };
    return this;
  }

  withPolicy(options: PolicyOptions): this {
    this.options = { ...this.options, policy: options };
    return this;
  }

  /** Advanced/testing: DI override (Prompt 2 §1.1). */
  withPlatformBridge(bridge: IPlatformBridge): this {
    this.options = { ...this.options, platformBridge: bridge };
    return this;
  }

  build(): IVersionManagerCore {
    return VersionManager.configure(this.options);
  }
}
