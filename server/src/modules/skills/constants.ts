/** Constants for the skills module (pure — no I/O imports). */

/** Version recorded for a newly-created skill. */
export const INITIAL_SKILL_VERSION = 1;

/** Import limits: compressed upload, total uncompressed bytes, archive entry count. */
export const IMPORT_MAX_UPLOAD_BYTES = 1_048_576;
export const IMPORT_MAX_UNCOMPRESSED_BYTES = 5 * 1_048_576;
export const IMPORT_MAX_ENTRIES = 200;

/** Route body limit for the base64 import payload (~4/3 of the upload + JSON envelope). */
export const IMPORT_ROUTE_BODY_LIMIT = 1_600_000;

/** Archive entries that look executable — reported as a warning, never run. */
export const EXECUTABLE_EXTENSIONS = [
  '.sh',
  '.bash',
  '.zsh',
  '.py',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.rb',
  '.pl',
  '.ps1',
  '.bat',
  '.cmd',
  '.exe',
  '.bin',
  '.so',
  '.dylib',
  '.jar',
];

export const TRUST_WARNING =
  "An imported skill is someone else's instructions inside your agents' prompt. Read the body before saving.";
