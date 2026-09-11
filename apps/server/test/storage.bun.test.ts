// Runs under `bun test`, not vitest. Vitest executes on Node, where the
// bun:sqlite import fails and createScoreStore falls back to memory — so the
// SQLite path is invisible to that suite. This file exercises it on the same
// runtime production uses.
import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { createScoreStore } from '../src/storage';

const logger = pino({ level: 'silent' });
const dirs: string[] = [];

const freshDbPath = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drafty-bird-store-'));
  dirs.push(dir);
  return path.join(dir, 'db.sqlite');
};

afterEach(() => {
  while (dirs.length > 0) {
    fs.rmSync(dirs.pop() as string, { recursive: true, force: true });
  }
});

describe('SQLite score store', () => {
  it('uses SQLite rather than the memory fallback', async () => {
    const store = await createScoreStore(freshDbPath(), logger);
    expect(store.mode).toBe('sqlite');
    await store.close();
  });

  it('persists scores across reopen', async () => {
    const dbPath = freshDbPath();

    const first = await createScoreStore(dbPath, logger);
    await first.insertScore({ player: 'ac', score: 42, createdAt: '2026-09-11T00:00:00.000Z' });
    await first.close();

    const second = await createScoreStore(dbPath, logger);
    expect(await second.getHighScore()).toBe(42);
    await second.close();
  });

  it('orders the leaderboard by score then creation time', async () => {
    const store = await createScoreStore(freshDbPath(), logger);
    await store.insertScore({ player: 'low', score: 1, createdAt: '2026-09-11T00:00:00.000Z' });
    await store.insertScore({ player: 'early', score: 9, createdAt: '2026-09-11T00:00:01.000Z' });
    await store.insertScore({ player: 'late', score: 9, createdAt: '2026-09-11T00:00:02.000Z' });

    expect((await store.getLeaderboard()).map((entry) => entry.player)).toEqual([
      'early',
      'late',
      'low',
    ]);
    await store.close();
  });

  it('reports a zero high score when empty', async () => {
    const store = await createScoreStore(freshDbPath(), logger);
    expect(await store.getHighScore()).toBe(0);
    await store.close();
  });
});
