import type {
  ILogSink,
  LogEntry,
  LogLevel,
} from '../../domain/models/VersionManagerOptions';

const LEVEL_ORDER: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  verbose: 5,
};

export class ConsoleLogSink implements ILogSink {
  write(entry: LogEntry): void {
    const line = `[VersionManager] ${entry.message}`;
    if (entry.level === 'error') {
      console.error(line, entry.metadata ?? {});
    } else if (entry.level === 'warn') {
      console.warn(line, entry.metadata ?? {});
    } else {
      console.info(line, entry.metadata ?? {});
    }
  }
}

export class Logger {
  private level: LogLevel;
  private readonly sink: ILogSink;

  constructor(level: LogLevel, sink: ILogSink) {
    this.level = level;
    this.sink = sink;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  verbose(message: string, metadata?: Record<string, unknown>): void {
    this.log('verbose', message, metadata);
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    if (LEVEL_ORDER[level] > LEVEL_ORDER[this.level]) return;
    this.sink.write({ level, message, timestamp: Date.now(), metadata });
  }
}
