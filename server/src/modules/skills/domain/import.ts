import { unzipSync, strFromU8 } from 'fflate';
import {
  SKILL_BODY_MAX,
  SKILL_DESCRIPTION_MAX,
  SKILL_NAME_MAX,
  SkillType,
  type SkillImportPreview,
} from '@devdigest/shared';
import {
  EXECUTABLE_EXTENSIONS,
  IMPORT_MAX_ENTRIES,
  IMPORT_MAX_UNCOMPRESSED_BYTES,
  IMPORT_MAX_UPLOAD_BYTES,
  TRUST_WARNING,
} from '../constants.js';

/**
 * Skill import — pure extraction of a skill's core (name, description, type,
 * markdown body) from an uploaded `.md` or `.zip`. Nothing here touches the
 * filesystem: archive entries are inflated in memory, only the chosen markdown
 * entry is decoded, and every other entry is merely LISTED in `ignored_files`.
 * Executable parts of an archive are never written out, interpreted or run.
 */

export class SkillImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillImportError';
  }
}

interface Frontmatter {
  meta: Record<string, string>;
  body: string;
}

/** Flat `key: value` frontmatter between leading `---` fences. No YAML engine on purpose. */
export function parseFrontmatter(text: string): Frontmatter {
  const normalized = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(normalized);
  if (!match) return { meta: {}, body: normalized };
  const meta: Record<string, string> = {};
  for (const line of match[1]!.split('\n')) {
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    meta[kv[1]!.toLowerCase()] = kv[2]!.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return { meta, body: normalized.slice(match[0].length) };
}

/** Kebab-case slug that satisfies `SkillName`. */
export function slugify(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/\.(md|markdown|zip)$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SKILL_NAME_MAX)
    .replace(/-+$/g, '');
  return slug || 'imported-skill';
}

/** First prose paragraph of a markdown body (headings/fences skipped). */
function firstParagraph(body: string): string {
  for (const block of body.split(/\n\s*\n/)) {
    const text = block
      .split('\n')
      .filter((l) => !/^\s*(#|```|---|<!--)/.test(l))
      .join(' ')
      .trim();
    if (text) return text;
  }
  return '';
}

const basename = (p: string) => p.split('/').pop() ?? p;
const isMarkdown = (p: string) => /\.(md|markdown)$/i.test(p);
const isExecutable = (p: string) =>
  /(^|\/)scripts?\//i.test(p) || EXECUTABLE_EXTENSIONS.some((ext) => p.toLowerCase().endsWith(ext));

/** Build the preview from one markdown document. */
export function previewFromMarkdown(
  text: string,
  sourceFile: string,
  extra: { ignored?: string[]; warnings?: string[]; fallbackName?: string } = {},
): SkillImportPreview {
  const { meta, body: rawBody } = parseFrontmatter(text);
  const warnings = [...(extra.warnings ?? [])];
  let body = rawBody.trim();
  if (!body) throw new SkillImportError(`${sourceFile} has no markdown body`);
  if (body.length > SKILL_BODY_MAX) {
    body = body.slice(0, SKILL_BODY_MAX);
    warnings.push(`Body truncated to ${SKILL_BODY_MAX} characters.`);
  }
  const parsedType = SkillType.safeParse(meta.type);
  if (meta.type && !parsedType.success) {
    warnings.push(`Unknown type "${meta.type}" — using "custom".`);
  }
  const description = (meta.description || firstParagraph(body) || 'Imported skill').slice(
    0,
    SKILL_DESCRIPTION_MAX,
  );
  warnings.push(TRUST_WARNING);
  return {
    name: slugify(meta.name || extra.fallbackName || basename(sourceFile)),
    description,
    type: parsedType.success ? parsedType.data : 'custom',
    body,
    source_file: sourceFile,
    ignored_files: extra.ignored ?? [],
    warnings,
  };
}

/** Pick the skill entry of an archive: SKILL.md at root / in the single top folder, else the only .md. */
function pickEntry(paths: string[]): string {
  const topDirs = new Set(paths.filter((p) => p.includes('/')).map((p) => p.split('/')[0]));
  const rootFiles = paths.filter((p) => !p.includes('/'));
  const candidates = ['SKILL.md'];
  if (topDirs.size === 1 && rootFiles.length === 0) candidates.push(`${[...topDirs][0]}/SKILL.md`);
  for (const c of candidates) {
    const hit = paths.find((p) => p.toLowerCase() === c.toLowerCase());
    if (hit) return hit;
  }
  const mds = paths.filter(isMarkdown);
  if (mds.length === 1) return mds[0]!;
  throw new SkillImportError(
    mds.length === 0
      ? 'The archive contains no markdown file'
      : 'The archive has several markdown files and no SKILL.md — add a SKILL.md',
  );
}

/** Extract a skill preview from a zip, entirely in memory. */
export function previewFromZip(bytes: Uint8Array, filename: string): SkillImportPreview {
  let entryCount = 0;
  let total = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      // Size/count guards run BEFORE inflating each entry (zip-bomb defence).
      filter: (f) => {
        entryCount += 1;
        total += f.originalSize;
        if (entryCount > IMPORT_MAX_ENTRIES) {
          throw new SkillImportError(`The archive has more than ${IMPORT_MAX_ENTRIES} entries`);
        }
        if (total > IMPORT_MAX_UNCOMPRESSED_BYTES) {
          throw new SkillImportError('The archive is too large when unpacked (max 5 MB)');
        }
        return true;
      },
    });
  } catch (err) {
    if (err instanceof SkillImportError) throw err;
    throw new SkillImportError('Not a valid zip archive');
  }

  const paths = Object.keys(files)
    .filter((p) => !p.endsWith('/') && !p.startsWith('__MACOSX/') && basename(p) !== '.DS_Store')
    .sort();
  const entry = pickEntry(paths);
  const ignored = paths.filter((p) => p !== entry);
  const warnings: string[] = [];
  const executables = ignored.filter(isExecutable);
  if (executables.length > 0) {
    warnings.push(
      `Ignored ${executables.length} executable file(s) — skills are text only; nothing from the archive is run.`,
    );
  }
  const folder = entry.includes('/') ? entry.split('/')[0] : undefined;
  return previewFromMarkdown(strFromU8(files[entry]!), entry, {
    ignored,
    warnings,
    fallbackName: folder ?? filename,
  });
}

/** Entry point: dispatch on the filename and enforce the upload limit. */
export function previewSkillImport(filename: string, bytes: Uint8Array): SkillImportPreview {
  if (bytes.byteLength === 0) throw new SkillImportError('The file is empty');
  if (bytes.byteLength > IMPORT_MAX_UPLOAD_BYTES) {
    throw new SkillImportError('The file is too large (max 1 MB)');
  }
  if (/\.zip$/i.test(filename)) return previewFromZip(bytes, filename);
  if (isMarkdown(filename)) return previewFromMarkdown(strFromU8(bytes), basename(filename));
  throw new SkillImportError('Upload a .md file or a .zip archive');
}
