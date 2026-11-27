import type { Container } from '../../platform/container.js';

/** The container members this code actually uses. */
export type TokensServiceDeps = Pick<Container, 'tokenizer'>;

/**
 * Token counting for the editors (skill body, agent system prompt). Uses the
 * same tokenizer as the run trace's `prompt_tokens`, so the number the editor
 * shows matches the block size in a later trace.
 */
export class TokensService {
  constructor(private deps: TokensServiceDeps) {}

  count(text: string): number {
    return this.deps.tokenizer.count(text);
  }
}
