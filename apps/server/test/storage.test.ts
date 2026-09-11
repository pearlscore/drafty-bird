import pino from 'pino';
import { afterEach, describe, expect, it } from 'vitest';
import { createScoreStore } from '../src/storage';

// Vitest runs on Node, where bun:sqlite cannot resolve. storage.bun.test.ts
// covers the SQLite path under `bun test`.
const logger = pino({ level: 'silent' });
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('score store outside the Bun runtime', () => {
  it('falls back to memory when not in production', async () => {
    const store = await createScoreStore('/tmp/drafty-bird-storage-test.sqlite', logger);
    expect(store.mode).toBe('memory');
  });

  it('refuses to start in production', async () => {
    process.env.NODE_ENV = 'production';
    await expect(createScoreStore('/tmp/drafty-bird-storage-test.sqlite', logger)).rejects.toThrow(
      /Bun runtime/,
    );
  });
});
