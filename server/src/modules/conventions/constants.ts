/** Conventions Extractor tuning. Pure values only (domain ring). */

/** Ranked source files sent to the model (from repoIntel.getConventionSamples). */
export const SAMPLE_FILE_COUNT = 12;

/** Per-file cap on the content sent to the model, in characters. */
export const MAX_FILE_CHARS = 8_000;

/** Repo-root config files probed for team conventions (missing ones are skipped). */
export const CONFIG_FILES = [
  'tsconfig.json',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.js',
  'prettier.config.js',
  'biome.json',
  '.editorconfig',
] as const;

/** Structured-output schema name (also the MockLLMProvider fixture key). */
export const EXTRACTION_SCHEMA_NAME = 'ConventionExtraction';

export const EXTRACTION_TEMPERATURE = 0.2;
export const EXTRACTION_TIMEOUT_MS = 120_000;
