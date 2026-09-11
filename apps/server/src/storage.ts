import fs from 'node:fs';
import path from 'node:path';
import type pino from 'pino';

export interface ScoreEntry {
  player: string;
  score: number;
  createdAt: string;
}

export interface ScoreStore {
  mode: 'memory' | 'sqlite';
  ready: boolean;
  insertScore(entry: ScoreEntry): Promise<void>;
  getLeaderboard(limit?: number): Promise<ScoreEntry[]>;
  getHighScore(): Promise<number>;
  close(): Promise<void>;
}

const sortScores = (entries: ScoreEntry[]): ScoreEntry[] =>
  [...entries].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });

const createMemoryStore = (): ScoreStore => {
  const entries: ScoreEntry[] = [];

  return {
    mode: 'memory',
    ready: true,
    async insertScore(entry) {
      entries.push(entry);
    },
    async getLeaderboard(limit = 10) {
      return sortScores(entries).slice(0, limit);
    },
    async getHighScore() {
      if (entries.length === 0) {
        return 0;
      }
      return Math.max(...entries.map((entry) => entry.score));
    },
    async close() {
      return;
    },
  };
};

type SqliteDatabase = InstanceType<typeof import('bun:sqlite').Database>;

const createSqliteStore = (db: SqliteDatabase, dbPath: string, logger: pino.Logger): ScoreStore => {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const insertStmt = db.prepare(
    'INSERT INTO scores (player, score, created_at) VALUES ($player, $score, $created_at)',
  );
  const leaderboardStmt = db.prepare(
    'SELECT player, score, created_at FROM scores ORDER BY score DESC, created_at ASC LIMIT ?',
  );
  const highScoreStmt = db.prepare('SELECT COALESCE(MAX(score), 0) AS high_score FROM scores');

  logger.info({ dbPath }, 'SQLite leaderboard store ready');

  return {
    mode: 'sqlite',
    ready: true,
    async insertScore(entry) {
      insertStmt.run({
        $player: entry.player,
        $score: entry.score,
        $created_at: entry.createdAt,
      });
    },
    async getLeaderboard(limit = 10) {
      const rows = leaderboardStmt.all(limit) as Array<{
        player: string;
        score: number;
        created_at: string;
      }>;
      return rows.map((row) => ({
        player: row.player,
        score: row.score,
        createdAt: row.created_at,
      }));
    },
    async getHighScore() {
      const row = highScoreStmt.get() as { high_score: number };
      return row.high_score ?? 0;
    },
    async close() {
      db.close();
    },
  };
};

// Only the import is guarded. bun:sqlite resolves solely under the Bun runtime,
// so a failed import means the wrong runtime: fatal in production (degrading to
// memory would lose every score on restart), a warning elsewhere so vitest can
// run on Node. Any later failure (bad path, corrupt file) is a real error in
// every environment and propagates with SQLite's own message.
export const createScoreStore = async (
  dbPath: string,
  logger: pino.Logger,
): Promise<ScoreStore> => {
  let Database: typeof import('bun:sqlite').Database;
  try {
    ({ Database } = await import('bun:sqlite'));
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `SQLite leaderboard store unavailable at ${dbPath}. ` +
          'bun:sqlite requires the Bun runtime — start the server with `bun`, not `node`.',
        { cause: error },
      );
    }
    logger.warn(
      { err: error, dbPath },
      'bun:sqlite unavailable outside the Bun runtime. Using in-memory leaderboard store',
    );
    return createMemoryStore();
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return createSqliteStore(new Database(dbPath, { create: true }), dbPath, logger);
};
