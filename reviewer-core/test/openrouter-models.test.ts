import { describe, it, expect, vi, afterEach } from 'vitest';
import { OpenRouterProvider, isBatchOnly } from '../src/llm/openrouter.js';

afterEach(() => vi.unstubAllGlobals());

describe('OpenRouterProvider.listModels', () => {
  it('drops :batch-only variants (unusable via chat/completions)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: [
              { id: 'anthropic/claude-haiku-5.5', pricing: { prompt: '0.0000001', completion: '0.0000005' } },
              { id: 'anthropic/claude-haiku-5.5:batch', pricing: { prompt: '0.00000005', completion: '0.00000025' } },
              { id: 'deepseek/deepseek-v4-flash:free', pricing: { prompt: '0', completion: '0' } },
            ],
          }),
        ),
      ),
    );
    const ids = (await new OpenRouterProvider('k').listModels()).map((m) => m.id);
    expect(ids).toEqual(['deepseek/deepseek-v4-flash:free', 'anthropic/claude-haiku-5.5']);
  });

  it('isBatchOnly matches only the :batch suffix', () => {
    expect(isBatchOnly('openai/gpt-5.6-luna:batch')).toBe(true);
    expect(isBatchOnly('openai/gpt-5.6-luna')).toBe(false);
    expect(isBatchOnly('x/batch-model')).toBe(false);
  });
});
