export type LogLevel = "debug" | "info" | "warn" | "error";

export type ObserverLogEntry = {
  level: LogLevel;
  message: string;
  timestamp?: string;
  context?: unknown;
  tags?: unknown;
  stack?: string;
  meta?: unknown;
};

export type ObserverConfig = {
  baseUrl: string;
  apiKey: string;
  appName: string;
  source?: string;
  componentId?: string;
  maxBatchSize?: number;
  flushIntervalMs?: number;
  onError?: (error: unknown) => void;
};

type SendPayload = {
  appName: string;
  source?: string;
  componentId?: string;
  logs: ObserverLogEntry[];
};

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_FLUSH_INTERVAL = 3000;

export class ObserverClient {
  private readonly config: ObserverConfig;
  private readonly queue: ObserverLogEntry[] = [];
  private flushTimer?: number;
  private defaultContext?: unknown;
  private defaultTags?: unknown;

  constructor(config: ObserverConfig) {
    this.config = {
      maxBatchSize: DEFAULT_BATCH_SIZE,
      flushIntervalMs: DEFAULT_FLUSH_INTERVAL,
      ...config,
    };
  }

  setContext(context: unknown) {
    this.defaultContext = context;
  }

  setTags(tags: unknown) {
    this.defaultTags = tags;
  }

  log(level: LogLevel, message: string, context?: unknown, meta?: unknown) {
    const entry: ObserverLogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: context ?? this.defaultContext,
      tags: this.defaultTags,
      meta,
    };
    this.queue.push(entry);
    this.scheduleFlush();
    if (this.queue.length >= (this.config.maxBatchSize ?? DEFAULT_BATCH_SIZE)) {
      void this.flush();
    }
  }

  debug(message: string, context?: unknown, meta?: unknown) {
    this.log("debug", message, context, meta);
  }

  info(message: string, context?: unknown, meta?: unknown) {
    this.log("info", message, context, meta);
  }

  warn(message: string, context?: unknown, meta?: unknown) {
    this.log("warn", message, context, meta);
  }

  error(message: string, context?: unknown, meta?: unknown, stack?: string) {
    const entry: ObserverLogEntry = {
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      context: context ?? this.defaultContext,
      tags: this.defaultTags,
      meta,
      stack,
    };
    this.queue.push(entry);
    this.scheduleFlush();
  }

  captureError(err: unknown, context?: unknown, meta?: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    this.error(error.message, context, meta, error.stack);
  }

  async flush() {
    if (!this.queue.length) return;
    const batch = this.queue.splice(0, this.config.maxBatchSize ?? DEFAULT_BATCH_SIZE);
    const payload: SendPayload = {
      appName: this.config.appName,
      source: this.config.source,
      componentId: this.config.componentId,
      logs: batch,
    };

    try {
      const fetchFn = globalThis.fetch;
      if (!fetchFn) {
        throw new Error("Fetch is not available in this runtime.");
      }
      const res = await fetchFn(`${this.config.baseUrl.replace(/\/+$/, "")}/observer/logs/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `ApiKey ${this.config.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`Observer ingest failed: ${res.status}`);
      }
    } catch (error) {
      this.queue.unshift(...batch);
      if (this.config.onError) {
        this.config.onError(error);
      }
    }
  }

  shutdown() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    void this.flush();
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    const setTimer = globalThis.setTimeout?.bind(globalThis);
    if (!setTimer) return;
    this.flushTimer = setTimer(() => {
      this.flushTimer = undefined;
      void this.flush();
    }, this.config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL) as unknown as number;
  }
}

export const createObserver = (config: ObserverConfig) => new ObserverClient(config);
