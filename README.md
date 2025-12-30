# pushlab-observer

PushLab observer client for log ingestion across backend, frontend, desktop, and worker apps.

## Install

```bash
npm install pushlab-observer
```

## What it does

`pushlab-observer` sends structured JSON logs to the PushLab Observer API using an API key.
It batches logs, retries on failure, and supports both browser and Node runtimes.

Use cases:
- Backend services (API, workers, CRON jobs).
- Frontend web apps.
- Desktop apps (Electron).
- Any environment with `fetch`.

Key fields:
- `appName`: required, identifies the emitting application.
- `source`: optional (`backend`, `frontend`, `desktop`, `worker`, etc).
- `componentId`: optional; required when `source="backend"` to map logs to a project component.

## Quick start

```ts
import { createObserver } from "pushlab-observer";

const observer = createObserver({
  baseUrl: "https://w8cdn.techspot.solutions",
  apiKey: "YOUR_API_KEY",
  appName: "plushlab-backend",
  source: "backend",
  componentId: "cmp_123",
  maxBatchSize: 25,
  flushIntervalMs: 3000,
  onError: (err) => {
    console.error("Observer error", err);
  },
});

observer.info("Boot completed", { port: 3000 });
observer.warn("Cache miss", { cacheKey: "user:123" });
observer.error("Unhandled error", { requestId: "req_456" });
```

## API

### `createObserver(config)`

Creates an `ObserverClient` instance.

### Config

```ts
type ObserverConfig = {
  baseUrl?: string;
  apiKey?: string;
  appName: string;
  source?: string;
  componentId?: string;
  maxBatchSize?: number;
  flushIntervalMs?: number;
  onError?: (error: unknown) => void;
};
```

You can also omit `baseUrl` and `apiKey` and let the client read from environment variables:

- `PUSHLAB_OBSERVER_URL`
- `PUSHLAB_OBSERVER_API_KEY`
- `VITE_PUSHLAB_OBSERVER_URL`
- `VITE_PUSHLAB_OBSERVER_API_KEY`
- `NEXT_PUBLIC_PUSHLAB_OBSERVER_URL`
- `NEXT_PUBLIC_PUSHLAB_OBSERVER_API_KEY`
- `REACT_APP_PUSHLAB_OBSERVER_URL`
- `REACT_APP_PUSHLAB_OBSERVER_API_KEY`

Example:

```ts
const observer = createObserver({
  appName: "my-service",
});
```

Defaults:
- `maxBatchSize`: 20
- `flushIntervalMs`: 3000

### Methods

- `log(level, message, context?, meta?)`
- `debug(message, context?, meta?)`
- `info(message, context?, meta?)`
- `warn(message, context?, meta?)`
- `error(message, context?, meta?, stack?)`
- `captureError(error, context?, meta?)`
- `flush()`
- `shutdown()`
- `setContext(context)`
- `setTags(tags)`

## Log entry shape

```ts
type ObserverLogEntry = {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  timestamp?: string;
  context?: unknown;
  tags?: unknown;
  stack?: string;
  meta?: unknown;
};
```

## Batching and delivery

- Logs are buffered until `maxBatchSize` or `flushIntervalMs` is reached.
- `flush()` sends immediately.
- `shutdown()` flushes and stops timers.
- Errors are forwarded to `onError`, if provided.

## Server API contract

- Endpoint: `POST /observer/logs/ingest`
- Headers:
  - `Authorization: ApiKey <key>`
  - `Content-Type: application/json`
- Body:
  ```json
  {
    "appName": "plushlab-backend",
    "source": "backend",
    "componentId": "cmp_123",
    "logs": [
      {
        "level": "info",
        "message": "Boot completed",
        "timestamp": "2025-01-01T10:00:00.000Z",
        "context": { "port": 3000 }
      }
    ]
  }
  ```

Notes:
- For `source="backend"` logs, `componentId` is required by the API.
- Retention is enforced server-side (currently 7 days).

## Environment notes

- Node 18+ provides `fetch` by default.
- For older Node versions, bring your own fetch polyfill.

## Troubleshooting

- `401 Unauthorized`: verify the API key and header format.
- `400 Bad Request`: missing `appName` or invalid payload.
- `422 Unprocessable`: `componentId` missing for backend source.

## License

UNLICENSED
