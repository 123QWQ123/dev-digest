import { eq, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { SettingsRow } from './helpers.js';

/** Settings data-access: non-secret prefs stored as (workspace, user, key) → value rows. */
export class SettingsRepository {
  constructor(private db: Db) {}

  list(workspaceId: string): Promise<SettingsRow[]> {
    return this.db
      .select({ key: t.settings.key, value: t.settings.value })
      .from(t.settings)
      .where(eq(t.settings.workspaceId, workspaceId));
  }

  /** Upsert every key of `values` for the user — one statement, so all or nothing. */
  async upsertMany(workspaceId: string, userId: string, values: Record<string, unknown>): Promise<void> {
    const entries = Object.entries(values);
    if (entries.length === 0) return;
    await this.db
      .insert(t.settings)
      .values(entries.map(([key, value]) => ({ workspaceId, userId, key, value })))
      .onConflictDoUpdate({
        target: [t.settings.workspaceId, t.settings.userId, t.settings.key],
        set: { value: sql`excluded.value` },
      });
  }
}
