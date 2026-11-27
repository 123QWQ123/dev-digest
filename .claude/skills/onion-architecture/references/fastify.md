# Fastify as the outer ring

Fastify is a delivery mechanism. It belongs to the edge ring: it parses HTTP, validates, calls a use case and
serialises the result. Nothing inside the onion should know Fastify exists. For the Fastify API itself
(hooks, schemas, serializers, plugin options) use `fastify-best-practices`.

## 1. Thin routes

A handler does four things and nothing else:

```ts
app.get('/pulls/:id', { schema: { params: IdParams } }, async (req): Promise<PrDetail> => {
  const { workspaceId } = await getContext(container, req); // 1. request context
  //                                                          2. input already validated by zod schema
  return pulls.getDetail(workspaceId, req.params.id);         // 3. one use-case call → 4. return contract
});
```

- No `drizzle-orm`, `container.db`, SDK clients, `for` loops over DB rows, or business `if`s.
- Domain errors are thrown by the service as `AppError`/`NotFoundError` (`platform/errors.ts`); the global
  error handler maps them to HTTP. Don't build HTTP status logic in services.
- Services never receive `req`/`reply`. Pass plain values (`workspaceId`, ids, validated body).
- Construct the service once per plugin (`const service = new XService(...)` at plugin scope), not per request.

## 2. Plugins and encapsulation

- `register` creates a **new encapsulated context**; parent contexts cannot see what a child declares, and
  siblings cannot see each other. [12][13]
- `fastify-plugin` breaks encapsulation **only for the plugin it wraps** — use it for app-wide
  infrastructure (decorators like `container`, auth, error handler), not for feature modules. [12]
- Each feature module is its own encapsulated plugin, which is Fastify's natural "module boundary" for a
  modular monolith [14] — but encapsulation hides decorators/hooks, **not imports**. TypeScript imports
  between modules are policed by dependency-cruiser (`onion-no-cross-module-internals`), not by Fastify.
- Decorators are available only after `.ready()`/`.listen()`/`.inject()` loaded the plugin chain. [13]

> **In this repo:** modules are registered statically in `src/modules/index.ts` (no autoload — portable
> under tsx, vitest and the bundler). `app.ts` decorates the instance with `container`.

## 3. Composition root and DI

- A composition root is a **unique place, close to the entry point, where modules are composed**; only the
  application has one, and a DI container is referenced **only from there**. [8]
- Onion does not require an IoC container [3]. A hand-written container is fine and keeps wiring explicit.
  Libraries like `@fastify/awilix` [16] are an option, not a requirement — don't introduce one without an ADR.

> **In this repo:** `src/app.ts` builds `new Container(config, db, overrides)` and decorates the app;
> `platform/container.ts` lazily constructs adapters (resolving secrets) and shared repositories.
> Tests inject fakes through `ContainerOverrides`.

The rule that keeps the container from becoming a service locator:

| ✅ Do | ❌ Don't |
|---|---|
| `modules/<m>/compose.ts` reads from the container and passes concrete deps into the service ctor; the route calls `createXService(app.container, app.log)` | Service ctor takes `Container` and reaches into `container.db`, `container.github()`… |
| Service ctor declares narrow types: `(repo: ReviewRepository, agents: AgentsRepository, llm: LlmResolver)` | `new XService(container)` everywhere |
| Lazy/async adapters passed as a function: `github: () => Promise<GitHubClient>` | Service calling `container.github()` itself |
| Transitional: `constructor(deps: Pick<Container, 'agentsRepo' \| 'runBus'>)` | Widening the `Pick` every PR |

Narrow deps make the dependency graph visible in the signature and let unit tests pass small fakes instead
of constructing a whole container.

## 4. Errors

- Domain/app rings throw typed errors from `platform/errors.ts` (`AppError`, `NotFoundError`,
  `ConfigError`) — these are plain classes with no Fastify import, so they are safe in inner rings.
- Mapping to HTTP status + body happens once, in the edge (the app's error handler).

## 5. Background work and streaming

- Jobs (`platform/jobs.ts`) and the SSE bus (`platform/sse.ts`) are infrastructure. The **job body** is a
  service method; the route only enqueues. Every fire-and-forget promise needs a rejection handler.
- Services publish run events to the bus they were given; SSE framing (`fastify-sse-v2`) stays in the route.
