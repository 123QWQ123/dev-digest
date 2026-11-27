/**
 * Onion Architecture guardrails for server/ — see .claude/skills/onion-architecture/.
 *
 * Rings (inside → out):
 *   domain   modules/<m>/{domain.ts,domain/**,ports.ts,constants.ts}   pure, no I/O
 *   app      modules/<m>/service.ts (+ helpers)                       use cases
 *   infra    modules/<m>/repository{.ts,/**}, src/db/**, src/adapters/**
 *   edge     modules/<m>/routes.ts, platform/container.ts, app.ts, server.ts
 * Dependencies point inward only.
 *
 * Run:      pnpm arch:check       (fails only on violations NOT in the baseline)
 * Baseline: pnpm arch:baseline    (re-record known violations; shrink it, never grow it casually)
 */

// Files allowed to talk to the ORM / DB schema directly.
const INFRA_DB =
  '^src/(db/|adapters/|app\\.ts$|server\\.ts$|platform/container\\.ts$)|^src/modules/[^/]+/(repository(\\.ts$|/)|[^/]+\\.repo\\.ts$)';
// Inner ring: pure domain + ports.
const DOMAIN = '^src/modules/[^/]+/(domain(\\.ts$|/)|ports\\.ts$|constants\\.ts$)';
// Outer-ring libraries the domain must never see.
const IO_LIBS =
  '(^|/)node_modules/(fastify|@fastify|fastify-[^/]+|drizzle-orm|postgres|octokit|@octokit|openai|@anthropic-ai|simple-git|p-queue|@vscode/ripgrep|@ast-grep)/|^(node:)?(fs|child_process|net|http|https)$';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'onion-orm-only-in-infra',
      comment:
        'drizzle-orm and src/db/{schema,client} are infrastructure. Only repositories, src/db, adapters and the ' +
        'composition root may import them. Move the query into modules/<m>/repository.ts and call it from the service.',
      severity: 'error',
      from: { path: '^src/', pathNot: INFRA_DB },
      to: { path: '(^|/)node_modules/drizzle-orm/|^src/db/(schema(\\.ts$|/)|client\\.ts$)' },
    },
    {
      name: 'onion-routes-only-call-services',
      comment:
        'A route (edge ring) must not reach past the service into repositories or the DB. ' +
        'routes.ts → service.ts → repository.ts.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/routes\\.ts$' },
      to: {
        path: '^src/modules/[^/]+/(repository(\\.ts$|/)|[^/]+\\.repo\\.ts$)|^src/db/|^src/adapters/',
      },
    },
    {
      name: 'onion-domain-is-pure',
      comment:
        'Domain files (domain.ts, domain/**, ports.ts, constants.ts) hold types, rules and interfaces only: ' +
        'no framework, ORM, SDK, filesystem, or outer-ring module imports.',
      severity: 'error',
      from: { path: DOMAIN },
      to: {
        path:
          IO_LIBS +
          '|^src/(db|adapters)/|^src/platform/container\\.ts$|^src/modules/[^/]+/(routes|service|repository|run-executor)(\\.ts$|/)',
      },
    },
    {
      name: 'onion-adapters-not-to-modules',
      comment:
        'Adapters implement ports declared in @devdigest/shared (vendor/shared/adapters.ts) or a module ports.ts. ' +
        'They must not depend on feature modules — move the shared type inward (into ports.ts / shared).',
      severity: 'error',
      from: { path: '^src/adapters/' },
      to: { path: '^src/modules/', pathNot: '^src/modules/[^/]+/(ports|types|domain)(\\.ts$|/)' },
    },
    {
      name: 'onion-platform-not-to-modules',
      comment:
        'platform/ is cross-cutting infrastructure. Only the composition root (platform/container.ts) may know ' +
        'about feature modules.',
      severity: 'error',
      from: { path: '^src/platform/', pathNot: '^src/platform/container\\.ts$' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'onion-no-cross-module-internals',
      comment:
        "A module may use another module only through its public surface (index.ts, types.ts, ports.ts) or via " +
        'the container. Never import another module\'s service/repository/helpers directly.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/[^/]+/',
        pathNot: '^src/modules/($1|_shared)/|^src/modules/[^/]+/(index|types|ports)\\.ts$',
      },
    },
    {
      name: 'onion-vendor-shared-is-leaf',
      comment: 'vendor/shared is the innermost contract layer (mirrored in client/). It must not import server code.',
      severity: 'error',
      from: { path: '^src/vendor/shared/' },
      to: { path: '^src/', pathNot: '^src/vendor/shared/' },
    },
    {
      name: 'no-circular',
      comment: 'Runtime import cycles break layering and module init order.',
      severity: 'error',
      from: {},
      to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } },
    },
    {
      name: 'not-to-unresolvable',
      comment: 'Import that cannot be resolved on disk.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^src/db/migrations/|\\.test\\.ts$' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.js', '.json'],
    },
  },
};
