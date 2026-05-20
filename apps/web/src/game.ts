import { HUMOR_LINES, SCORE_MESSAGE_INTERVAL } from './humor';

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

const GRAVITY = 0.32;
const FLAP_VELOCITY = -6.3;
const PIPE_SPEED = 2.9;
const PIPE_WIDTH = 82;
const PIPE_SPAWN_TICKS = 94;
const GAP_EDGE_MARGIN = 60;
const MAX_GAP_CENTER_DELTA = 180;
const DRAFT_PUSH_PER_LEVEL = 0.045;
const SPIN_BASE = 0.08;
const SPIN_PER_LEVEL = 0.14;

export type DraftLevel = 1 | 2 | 3;
export type DraftDirection = -1 | 1;

export const DRAFT_GAP_HEIGHTS: Record<DraftLevel, number> = {
  1: 150,
  2: 180,
  3: 220,
};

export type GamePhase = 'idle' | 'running' | 'gameover';

export interface Bird {
  x: number;
  y: number;
  velocityY: number;
  radius: number;
}

export interface Obstacle {
  id: number;
  x: number;
  width: number;
  gapTop: number;
  gapHeight: number;
  draftLevel: DraftLevel;
  draftDirection: DraftDirection;
  passed: boolean;
}

export interface GameState {
  phase: GamePhase;
  runId: number;
  tick: number;
  rngSeed: number;
  nextObstacleTick: number;
  nextObstacleId: number;
  lastGapCenter: number | null;
  detectorAngle: number;
  bird: Bird;
  obstacles: Obstacle[];
  score: number;
  statusText: string;
}

const idleStatus = 'Tap Space or click to start sealing drafts.';

export const createInitialState = (seed = 1337): GameState => ({
  phase: 'idle',
  runId: 0,
  tick: 0,
  rngSeed: seed >>> 0,
  nextObstacleTick: PIPE_SPAWN_TICKS,
  nextObstacleId: 1,
  lastGapCenter: null,
  detectorAngle: 0,
  bird: {
    x: 220,
    y: GAME_HEIGHT / 2,
    velocityY: 0,
    radius: 14,
  },
  obstacles: [],
  score: 0,
  statusText: idleStatus,
});

export const beginGame = (state: GameState): GameState => ({
  ...createInitialState(state.rngSeed),
  phase: 'running',
  runId: state.runId + 1,
  statusText: 'Draft Detector deployed.',
});

export const flap = (state: GameState): GameState => {
  if (state.phase !== 'running') {
    return state;
  }

  return {
    ...state,
    bird: {
      ...state.bird,
      velocityY: FLAP_VELOCITY,
    },
  };
};

export const stepGame = (state: GameState): GameState => {
  if (state.phase !== 'running') {
    return state;
  }

  const tick = state.tick + 1;
  let seed = state.rngSeed;
  let nextObstacleId = state.nextObstacleId;
  let nextObstacleTick = state.nextObstacleTick;
  let lastGapCenter = state.lastGapCenter;

  const movedObstacles = state.obstacles
    .map((obstacle) => ({
      ...obstacle,
      x: obstacle.x - PIPE_SPEED,
    }))
    .filter((obstacle) => obstacle.x + obstacle.width > -8);

  if (tick >= nextObstacleTick) {
    const levelRoll = nextRandom(seed);
    seed = levelRoll.seed;
    const draftLevel = (Math.floor(levelRoll.value * 3) + 1) as DraftLevel;
    const gapHeight = DRAFT_GAP_HEIGHTS[draftLevel];

    const directionRoll = nextRandom(seed);
    seed = directionRoll.seed;
    const draftDirection: DraftDirection = directionRoll.value < 0.5 ? -1 : 1;

    const positionRoll = nextRandom(seed);
    seed = positionRoll.seed;
    const minGapTop = GAP_EDGE_MARGIN;
    const maxGapTop = GAME_HEIGHT - gapHeight - GAP_EDGE_MARGIN;
    let gapTop = minGapTop + Math.floor(positionRoll.value * (maxGapTop - minGapTop + 1));

    if (lastGapCenter !== null) {
      const center = gapTop + gapHeight / 2;
      const delta = center - lastGapCenter;
      if (Math.abs(delta) > MAX_GAP_CENTER_DELTA) {
        const clampedCenter = lastGapCenter + Math.sign(delta) * MAX_GAP_CENTER_DELTA;
        gapTop = Math.round(clampedCenter - gapHeight / 2);
        gapTop = Math.max(minGapTop, Math.min(maxGapTop, gapTop));
      }
    }

    movedObstacles.push({
      id: nextObstacleId,
      x: GAME_WIDTH + PIPE_WIDTH,
      width: PIPE_WIDTH,
      gapTop,
      gapHeight,
      draftLevel,
      draftDirection,
      passed: false,
    });
    lastGapCenter = gapTop + gapHeight / 2;
    nextObstacleId += 1;
    nextObstacleTick += PIPE_SPAWN_TICKS;
  }

  const bird = {
    ...state.bird,
    velocityY: state.bird.velocityY + GRAVITY,
  };

  const activeObstacle = movedObstacles.find(
    (o) => bird.x + bird.radius > o.x && bird.x - bird.radius < o.x + o.width,
  );
  const activeDraftLevel = activeObstacle?.draftLevel ?? 0;
  if (activeObstacle) {
    bird.velocityY += activeObstacle.draftDirection * activeDraftLevel * DRAFT_PUSH_PER_LEVEL;
  }
  bird.y += bird.velocityY;

  const detectorAngle = state.detectorAngle + SPIN_BASE + activeDraftLevel * SPIN_PER_LEVEL;

  let score = state.score;
  const scoredObstacles = movedObstacles.map((obstacle) => {
    if (!obstacle.passed && obstacle.x + obstacle.width < bird.x) {
      score += 1;
      return { ...obstacle, passed: true };
    }
    return obstacle;
  });

  const collided = hasCollision(bird, scoredObstacles);
  if (collided) {
    return {
      ...state,
      phase: 'gameover',
      tick,
      rngSeed: seed,
      nextObstacleId,
      nextObstacleTick,
      lastGapCenter,
      detectorAngle,
      bird,
      obstacles: scoredObstacles,
      score,
      statusText: 'Run complete. The draft won this round.',
    };
  }

  return {
    ...state,
    tick,
    rngSeed: seed,
    nextObstacleId,
    nextObstacleTick,
    lastGapCenter,
    detectorAngle,
    bird,
    obstacles: scoredObstacles,
    score,
    statusText: nextStatusText(score, state.statusText),
  };
};

const nextRandom = (seed: number): { seed: number; value: number } => {
  const nextSeed = (seed * 1664525 + 1013904223) >>> 0;
  return {
    seed: nextSeed,
    value: nextSeed / 0xffffffff,
  };
};

const nextStatusText = (score: number, currentStatus: string): string => {
  if (score <= 0 || score % SCORE_MESSAGE_INTERVAL !== 0) {
    return currentStatus;
  }

  const idx = Math.floor(score / SCORE_MESSAGE_INTERVAL - 1) % HUMOR_LINES.length;
  return HUMOR_LINES[idx] ?? currentStatus;
};

export const hasCollision = (bird: Bird, obstacles: Obstacle[]): boolean => {
  if (bird.y - bird.radius <= 0 || bird.y + bird.radius >= GAME_HEIGHT) {
    return true;
  }

  for (const obstacle of obstacles) {
    const intersectsX =
      bird.x + bird.radius > obstacle.x && bird.x - bird.radius < obstacle.x + obstacle.width;

    if (!intersectsX) {
      continue;
    }

    const hitsTop = bird.y - bird.radius < obstacle.gapTop;
    const hitsBottom = bird.y + bird.radius > obstacle.gapTop + obstacle.gapHeight;

    if (hitsTop || hitsBottom) {
      return true;
    }
  }

  return false;
};
