import type { Container } from '../../platform/container.js';
import { TokensService } from './service.js';

/** Module composition root. */
export function createTokensService(container: Pick<Container, 'tokenizer'>): TokensService {
  return new TokensService({ tokenizer: container.tokenizer });
}
