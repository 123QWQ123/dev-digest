import type { ConnTestRequest, ConnTestResult, SecretsStatus, Settings, SettingsUpdate } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import type { SettingsRepository } from './repository.js';
import { GITHUB_PROVIDER, SECRET_KEY_BY_PROVIDER } from './constants.js';
import { rowsToSettings } from './helpers.js';

/** Platform services the settings use cases need (secrets + key-checked clients). */
export type SettingsPlatform = Pick<
  Container,
  'secrets' | 'github' | 'githubWithToken' | 'llm' | 'llmWithKey' | 'invalidateSecretCaches'
>;

export interface SettingsDeps {
  repo: SettingsRepository;
  platform: SettingsPlatform;
}

/**
 * F1 — settings use cases. Non-secret prefs live in the DB; secrets are only
 * ever read/written through the SecretsProvider and never returned.
 */
export class SettingsService {
  constructor(private deps: SettingsDeps) {}

  async get(workspaceId: string): Promise<Settings> {
    return rowsToSettings(await this.deps.repo.list(workspaceId));
  }

  async update(workspaceId: string, userId: string, values: SettingsUpdate): Promise<Settings> {
    await this.deps.repo.upsertMany(workspaceId, userId, values);
    return this.get(workspaceId);
  }

  /** Which provider keys are configured — booleans only, never the values. */
  async secretsStatus(): Promise<SecretsStatus> {
    const { secrets } = this.deps.platform;
    const entries = await Promise.all(
      (Object.entries(SECRET_KEY_BY_PROVIDER) as [keyof SecretsStatus, string][]).map(
        async ([provider, key]) => [provider, Boolean(await secrets.get(key))] as const,
      ),
    );
    return Object.fromEntries(entries) as SecretsStatus;
  }

  /**
   * Test a provider key. S11 (security hardening): a candidate key is verified
   * with a throwaway client FIRST and persisted only if the check passes — a
   * typo must never overwrite the working key in ~/.devdigest/secrets.json.
   */
  async testConnection({ provider, key }: ConnTestRequest): Promise<ConnTestResult> {
    const p = this.deps.platform;
    if (key && !p.secrets.set) {
      return { provider, ok: false, message: 'Secrets backend is read-only' };
    }
    let message: string;
    try {
      if (provider === GITHUB_PROVIDER) {
        const gh = key ? p.githubWithToken(key) : await p.github();
        const login = await gh.currentLogin();
        message = `Connected as @${login}`;
      } else {
        const llm = key ? await p.llmWithKey(provider, key) : await p.llm(provider);
        const models = await llm.listModels();
        message = `OK — ${models.length} models available`;
      }
    } catch (err) {
      const raw = (err as Error).message;
      // Provider SDK errors can echo the key back; never return it.
      const safe = key ? raw.split(key).join('[redacted]') : raw;
      return { provider, ok: false, message: key ? `${safe} — key not saved` : safe };
    }
    if (key) {
      try {
        await p.secrets.set!(SECRET_KEY_BY_PROVIDER[provider], key);
        p.invalidateSecretCaches();
      } catch (err) {
        return { provider, ok: false, message: `Key verified but could not be saved: ${(err as Error).message}` };
      }
    }
    return { provider, ok: true, message };
  }
}
