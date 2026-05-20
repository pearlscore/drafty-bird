import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchLeaderboard, notifyGameStarted, submitScore, type LeaderboardEntry } from './api';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  beginGame,
  createInitialState,
  flap,
  stepGame,
  type GameState,
  type Obstacle,
} from './game';
import './styles.css';

const TICK_MS = Math.round(1000 / 60);

const drawAirflow = (ctx: CanvasRenderingContext2D, obstacle: Obstacle, tick: number): void => {
  const streamCount = obstacle.draftLevel * 2 + 1;
  const dashLen = 14;
  const gapLen = 10;
  const cycle = dashLen + gapLen;
  const speed = 1.8 + obstacle.draftLevel * 1.2;
  const offset = -tick * speed * obstacle.draftDirection;
  const padding = 6;
  const startY = obstacle.gapTop - padding;
  const endY = obstacle.gapTop + obstacle.gapHeight + padding;

  ctx.save();
  ctx.strokeStyle = `rgba(37, 151, 236, ${0.28 + obstacle.draftLevel * 0.14})`;
  ctx.lineWidth = 1 + obstacle.draftLevel * 0.5;
  ctx.lineCap = 'round';
  ctx.setLineDash([dashLen, gapLen]);
  ctx.lineDashOffset = ((offset % cycle) + cycle) % cycle;

  for (let i = 0; i < streamCount; i += 1) {
    const x = obstacle.x + (obstacle.width / (streamCount + 1)) * (i + 1);
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }

  ctx.restore();
};

const drawDraftDetector = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  angle: number,
): void => {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.fillStyle = '#04B290';
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#1C4C75';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.rotate(angle);
  const armLen = radius * 0.95;
  for (let i = 0; i < 3; i += 1) {
    const angle = (i * 2 * Math.PI) / 3;
    const ax = Math.cos(angle) * armLen;
    const ay = Math.sin(angle) * armLen;

    ctx.strokeStyle = '#1C4C75';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(ax, ay);
    ctx.stroke();

    ctx.fillStyle = '#FCAF1F';
    ctx.beginPath();
    ctx.arc(ax, ay, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1C4C75';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = '#1C4C75';
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

const drawGame = (canvas: HTMLCanvasElement, state: GameState): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const bgGradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  bgGradient.addColorStop(0, '#ffffff');
  bgGradient.addColorStop(1, '#f0f7f9');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  for (const obstacle of state.obstacles) {
    ctx.fillStyle = '#1C4C75';
    ctx.fillRect(obstacle.x, 0, obstacle.width, obstacle.gapTop);
    ctx.fillRect(
      obstacle.x,
      obstacle.gapTop + obstacle.gapHeight,
      obstacle.width,
      GAME_HEIGHT - (obstacle.gapTop + obstacle.gapHeight),
    );

    ctx.fillStyle = '#2597EC';
    ctx.fillRect(obstacle.x - 4, obstacle.gapTop - 8, obstacle.width + 8, 8);
    ctx.fillRect(obstacle.x - 4, obstacle.gapTop + obstacle.gapHeight, obstacle.width + 8, 8);

    drawAirflow(ctx, obstacle, state.tick);
  }

  drawDraftDetector(ctx, state.bird.x, state.bird.y, state.bird.radius, state.detectorAngle);

  ctx.fillStyle = '#1C4C75';
  ctx.font = 'bold 42px Lato, system-ui, sans-serif';
  ctx.fillText(`${state.score}`, 28, 52);

  if (state.phase === 'idle' || state.phase === 'gameover') {
    ctx.fillStyle = 'rgba(28, 76, 117, 0.82)';
    ctx.fillRect(120, 185, 720, 160);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 34px Lato, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      state.phase === 'idle' ? 'Drafty Bird' : 'Run Complete',
      GAME_WIDTH / 2,
      250,
    );
    ctx.font = '400 24px Lato, system-ui, sans-serif';
    ctx.fillText(
      state.phase === 'idle' ? 'Spacebar or click to flap' : 'Use Restart for another run',
      GAME_WIDTH / 2,
      295,
    );
    ctx.textAlign = 'start';
  }
};

const App = (): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const submittedRunRef = useRef<number>(0);

  const [game, setGame] = useState(() => createInitialState());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [apiStatus, setApiStatus] = useState('API available');
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const restartPromptRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setGame((prev) => stepGame(prev));
    }, TICK_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    drawGame(canvasRef.current, game);
  }, [game]);

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const data = await fetchLeaderboard();
        setLeaderboard(data);
      } catch {
        setApiStatus('API unreachable. Game remains fully playable.');
      }
    };

    void loadLeaderboard();
  }, []);

  useEffect(() => {
    if (game.phase !== 'gameover') {
      return;
    }

    if (game.runId === 0 || submittedRunRef.current === game.runId) {
      return;
    }

    submittedRunRef.current = game.runId;

    const completeRun = async () => {
      try {
        await submitScore(game.score);
        const data = await fetchLeaderboard();
        setLeaderboard(data);
        setApiStatus('API available');
      } catch {
        setApiStatus('API unreachable. Score saved locally only in this browser session.');
      }
    };

    void completeRun();
  }, [game.phase, game.runId, game.score]);

  useEffect(() => {
    if (game.phase !== 'gameover') {
      setShowRestartPrompt(false);
      return;
    }
    const timer = window.setTimeout(() => setShowRestartPrompt(true), 1000);
    return () => window.clearTimeout(timer);
  }, [game.phase, game.runId]);

  useEffect(() => {
    if (showRestartPrompt) {
      restartPromptRef.current?.focus();
    }
  }, [showRestartPrompt]);

  const startNewRun = () => {
    setGame((prev) => beginGame(prev));
    void notifyGameStarted().catch(() => {
      setApiStatus('API unreachable. Gameplay unaffected.');
    });
  };

  const handleFlap = () => {
    if (game.phase === 'idle') {
      startNewRun();
      return;
    }

    setGame((prev) => flap(prev));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return;
      }
      event.preventDefault();

      if (showRestartPrompt) {
        startNewRun();
        return;
      }

      let started = false;
      setGame((prev) => {
        if (prev.phase === 'idle') {
          started = true;
          return beginGame(prev);
        }
        return flap(prev);
      });

      if (started) {
        void notifyGameStarted().catch(() => {
          setApiStatus('API unreachable. Gameplay unaffected.');
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showRestartPrompt]);

  const restartRun = () => {
    setGame((prev) => ({
      ...createInitialState(prev.rngSeed),
      runId: prev.runId,
    }));
  };

  const leaderboardRows = useMemo(() => leaderboard.slice(0, 10), [leaderboard]);

  return (
    <main className="app-shell">
      <header className="hero">
        <h1>Drafty Bird</h1>
        <p>Guide the Draft Detector past leaky ducts and stack up comfort points.</p>
      </header>

      <section className="game-layout">
        <article className="play-panel">
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            aria-label="Drafty Bird game board"
            onClick={handleFlap}
            className="game-canvas"
          />
          {game.phase === 'gameover' && showRestartPrompt && (
            <button
              type="button"
              ref={restartPromptRef}
              className="restart-prompt"
              onClick={startNewRun}
            >
              Press Space or click to fly again
            </button>
          )}
          <div className="meta-row" role="status" aria-live="polite">
            <span>{game.statusText}</span>
            <button type="button" onClick={restartRun}>
              Restart
            </button>
          </div>
          <p className="controls">Controls: press Spacebar or click the game board to flap.</p>
          <p className="api-status">{apiStatus}</p>
        </article>

        <aside className="score-panel">
          <h2>Top 10 Comfort Runs</h2>
          <ol>
            {leaderboardRows.length === 0 ? (
              <li>No scores yet. Start the first run.</li>
            ) : (
              leaderboardRows.map((entry, idx) => (
                <li key={`${entry.player}-${entry.createdAt}-${idx}`}>
                  <span>{entry.player}</span>
                  <strong>{entry.score}</strong>
                </li>
              ))
            )}
          </ol>
        </aside>
      </section>
    </main>
  );
};

export default App;
