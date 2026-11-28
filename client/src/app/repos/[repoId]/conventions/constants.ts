/** Confidence thresholds (0..1) for the bar color — same cut-offs as `ConfidenceNum`. */
export const CONFIDENCE_HIGH = 0.85;
export const CONFIDENCE_MID = 0.65;

/** Max length of a rule-derived `## heading` slug in the drafted skill body. */
export const RULE_SLUG_MAX = 40;

/** Mirrors CONVENTION_RULE_MAX in @devdigest/shared (client imports types only). */
export const CONVENTION_RULE_MAX = 500;

/** Fenced-code language by file extension in the drafted skill body. */
export const FENCE_LANG: Record<string, string> = {
  ts: "ts",
  tsx: "tsx",
  js: "js",
  jsx: "jsx",
  mjs: "js",
  cjs: "js",
  py: "python",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  rb: "ruby",
  cs: "csharp",
  php: "php",
  json: "json",
  css: "css",
  sql: "sql",
};

export const SKELETON_CARDS = 3;
