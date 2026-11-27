import type { Container } from '../../platform/container.js';
import { SettingsRepository } from './repository.js';
import { SettingsService, type SettingsPlatform } from './service.js';

/** Module composition root: builds the settings service from the app container. */
export function createSettingsService(container: Pick<Container, 'db'> & SettingsPlatform): SettingsService {
  return new SettingsService({ repo: new SettingsRepository(container.db), platform: container });
}
