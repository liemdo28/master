# OPERATOR DASHBOARD API PROOF

## Exposed API Endpoints

Implemented on the operator router:

- `GET /operator/api/operator/health`
- `GET /operator/api/operator/tasks`
- `GET /operator/api/operator/tasks/:id`

Base runtime endpoints are also implemented:

- `GET /operator/health`
- `GET /operator/capabilities`
- `POST /operator/tasks/run`
- `GET /operator/tasks/:id`
- `GET /operator/tasks/:id/evidence`

## Mi-Core Proxy State

The operator runtime is currently mounted directly inside mi-core through:

- `server/src/routes/operator-runtime.ts`
- `server/src/index.ts`

Future proxy option:

- Mi can keep these endpoints mounted directly or add a dedicated mi-core proxy layer later without changing the runtime contract.

## Verified Health Object

```json
{"ok":true,"service":"operator-runtime","mode":"safe-readonly","adapters":["playwright"],"version":"0.1.0"}