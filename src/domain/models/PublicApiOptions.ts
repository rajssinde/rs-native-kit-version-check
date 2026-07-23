export interface CheckForUpdatesOptions {
  bypassCache?: boolean;
  silent?: boolean;
  timeoutMs?: number;
  context?: Record<string, unknown>;
}

export interface ForceTriggerOptions {
  reason?: string;
}

export interface ResetIgnoredVersionsOptions {
  versions?: string[];
}
