/**
 * Import-boundary guardrails for client/ — see .claude/skills/frontend-architecture/ §7.
 *
 * Direction: app/ (routes) → components/ (cross-route) → lib/ (data, helpers) → vendor/ (kit, contracts).
 *
 * Run:      pnpm arch:check     (fails only on violations NOT in the baseline)
 * Baseline: pnpm arch:baseline  (only after FIXING violations — the file must shrink, never grow)
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'fe-shared-not-to-app',
      comment:
        'components/ and lib/ are shared; they must not import route code from app/. ' +
        'Move the needed piece into shared, or pass it in as a prop.',
      severity: 'error',
      from: { path: '^src/(components|lib)/' },
      to: { path: '^src/app/' },
    },
    {
      name: 'fe-lib-not-to-components',
      comment:
        'lib/ (API client, query hooks, pure helpers, providers) sits below components/. ' +
        'A lib module that needs a component is a component — move it to components/.',
      severity: 'error',
      from: { path: '^src/lib/' },
      to: { path: '^src/components/' },
    },
    {
      name: 'fe-no-cross-route-components',
      comment:
        "A route must not reach into another route's _components. Promote the component to " +
        'src/components/ once a second route needs it.',
      severity: 'error',
      from: { path: '^src/app/([^/]+)/' },
      to: { path: '^src/app/[^/]+/.*_components/', pathNot: '^src/app/$1/' },
    },
    {
      name: 'fe-vendor-is-leaf',
      comment: 'vendor/ui and vendor/shared are copied packages; they must not import app code.',
      severity: 'error',
      from: { path: '^src/vendor/' },
      to: { path: '^src/(app|components|lib)/' },
    },
    {
      name: 'fe-api-client-only-via-hooks',
      comment:
        'Components and pages go through lib/hooks/* (React Query), never the raw API client (lib/api.ts).',
      severity: 'error',
      from: { path: '^src/(app|components)/', pathNot: '\\.test\\.tsx?$' },
      to: { path: '^src/lib/api\\.ts$' },
    },
    {
      name: 'no-circular',
      comment: 'Runtime import cycles.',
      severity: 'error',
      from: {},
      to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^src/vendor/ui/|\\.next/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
  },
};
