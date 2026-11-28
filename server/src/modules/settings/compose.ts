import type { FeatureModelChoice, FeatureModelId } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { SettingsRepository } from './repository.js';
import { SettingsService, type SettingsPlatform } from './service.js';
import { resolveFeatureModel } from './feature-models.js';

/** Module composition root: builds the settings service from the app container. */
export function createSettingsService(container: Pick<Container, 'db'> & SettingsPlatform): SettingsService {
  return new SettingsService({ repo: new SettingsRepository(container.db), platform: container });
}

/** Resolves a system feature's provider+model: workspace override, else registry default. */
export type FeatureModelResolver = (
  workspaceId: string,
  id: FeatureModelId,
) => Promise<FeatureModelChoice>;

/** Feature-model lookup for other modules (e.g. conventions) without exposing the repository. */
export function createFeatureModelResolver(container: Pick<Container, 'db'>): FeatureModelResolver {
  const settings = new SettingsRepository(container.db);
  return (workspaceId, id) => resolveFeatureModel(settings, workspaceId, id);
}
