import { onMount, onCleanup, createSignal } from 'solid-js';
import { useGameContext } from '../store/game.store';
import { GameRenderer } from '../utils/game-renderer';
import { ReplayEngine, ReplayState } from '../utils/replay-engine';
import type { ReplayData } from '../types/game.types';

export default function ReplayScreen() {
  const store = useGameContext();
  let canvasRef: HTMLCanvasElement | null = null;
  let renderer: GameRenderer | null = null;
  let animationFrame: number = 0;
  let updateSize: () => void;

  const [isPlaying, setIsPlaying] = createSignal(false);
  const [playbackSpeed, setPlaybackSpeed] = createSignal(1);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [totalDuration, setTotalDuration] = createSignal(0);
  const [isDragging, setIsDragging] = createSignal(false);
  const [replayState, setReplayState] = createSignal<ReplayState | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);

  let replayEngine: ReplayEngine | null = null;
  let lastFrameTime: number = 0;
  let playbackTimeMs: number = 0;

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const initReplay = () => {
    const replayData = store.currentReplay as ReplayData;
    if (!replayData) {
      store.setIsInReplayMode(false);
      store.setCurrentReplay(null);
      return;
    }

    replayEngine = new ReplayEngine(replayData);
    const totalDurationMs = replayEngine.getTotalDuration();
    setTotalDuration(totalDurationMs);
    setCurrentTime(0);
    playbackTimeMs = 0;

    const initialState = replayEngine.getInitialState();
    setReplayState(initialState);
    setIsLoading(false);
  };

  const play = () => {
    if (!replayState()?.isEnded) {
      setIsPlaying(true);
    }
  };

  const pause = () => {
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying()) {
      pause();
    } else {
      play();
    }
  };

  const seekTo = (targetTimeMs: number) => {
    if (!replayEngine) return;

    setIsLoading(true);
    pause();

    requestAnimationFrame(() => {
      try {
        const newState = replayEngine!.rebuildStateTo(targetTimeMs);
        setReplayState(newState);
        playbackTimeMs = targetTimeMs;
        setCurrentTime(targetTimeMs);
      } finally {
        setIsLoading(false);
      }
    });
  };

  const handleProgressClick = (e: MouseEvent) => {
    if (!canvasRef) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const targetTime = ratio * totalDuration();
    seekTo(targetTime);
  };

  const handleProgressDrag = (e: MouseEvent) => {
    if (!isDragging() || !canvasRef) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const targetTime = ratio * totalDuration();
    seekTo(targetTime);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
  };

  const exitReplay = () => {
    store.setIsInReplayMode(false);
    store.setCurrentReplay(null);
  };

  const renderLoop = (timestamp: number) => {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const deltaTime = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    if (isPlaying() && replayEngine && replayState()) {
      playbackTimeMs += deltaTime * 1000 * playbackSpeed();
      playbackTimeMs = Math.min(playbackTimeMs, totalDuration());

      const newState = replayEngine.advanceTo(playbackTimeMs, replayState()!);
      setReplayState(newState);
      setCurrentTime(playbackTimeMs);

      if (newState.isEnded) {
        setIsPlaying(false);
      }
    }

    if (renderer && replayState() && !isLoading()) {
      renderer.render(replayState()!.game, null, null);
    }

    animationFrame = requestAnimationFrame(renderLoop);
  };

  onMount(() => {
    if (canvasRef) {
      renderer = new GameRenderer(canvasRef);
      
      updateSize = () => {
        if (!canvasRef || !renderer) return;
        const container = canvasRef.parentElement;
        if (container) {
          renderer.resize(container.clientWidth, container.clientHeight);
        }
      };
      
      updateSize();
      window.addEventListener('resize', updateSize);
      
      initReplay();
      lastFrameTime = performance.now();
      animationFrame = requestAnimationFrame(renderLoop);
    }
  });

  onCleanup(() => {
    if (updateSize) {
      window.removeEventListener('resize', updateSize);
    }
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    if (renderer) {
      renderer.destroy();
    }
  });

  const metadata = store.currentReplay?.metadata;
  const progress = totalDuration() > 0 ? (currentTime() / totalDuration()) * 100 : 0;

  return (
    <div class="replay-screen">
      <div class="replay-header">
        <div class="replay-info">
          <h2 class="replay-title">📹 游戏回放</h2>
          {metadata && (
            <div class="replay-meta">
              <span>地图: {metadata.mapName}</span>
              <span>玩家: {metadata.players.map(p => p.name).join(', ')}</span>
              <span>最终波次: {metadata.finalWave}</span>
              <span classList={{
                'text-green-600': metadata.victory,
                'text-red-600': !metadata.victory
              }}>
                {metadata.victory ? '🏆 胜利' : '💀 失败'}
              </span>
              <span>总事件: {metadata.totalEvents}</span>
            </div>
          )}
        </div>
        <button class="btn-secondary" onClick={exitReplay}>
          返回大厅
        </button>
      </div>

      <div class="replay-body">
        <div class="game-canvas-container replay-canvas-container">
          <canvas
            ref={(el) => { canvasRef = el; }}
            class="game-canvas"
          />
          
          {isLoading() && (
            <div class="replay-loading-overlay">
              <div class="replay-loading-spinner"></div>
              <p>正在重建游戏状态...</p>
            </div>
          )}

          {replayState() && (
            <div class="replay-hud">
              <div class="replay-hud-item">
                <span class="text-gold">💰</span>
                <span>{replayState()!.game.gold}</span>
              </div>
              <div class="replay-hud-item">
                <span class="text-red">❤️</span>
                <span>{replayState()!.game.lives} / {replayState()!.game.maxLives}</span>
              </div>
              <div class="replay-hud-item">
                <span class="text-blue">🌊</span>
                <span>第 {replayState()!.game.currentWave} 波</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div class="replay-controls">
        <button class="replay-btn-play" onClick={togglePlay}>
          {isPlaying() ? '⏸' : '▶'}
        </button>

        <div class="replay-time">
          {formatTime(currentTime())}
        </div>

        <div 
          class="replay-progress-container"
          onClick={handleProgressClick}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onMouseMove={handleProgressDrag}
        >
          <div class="replay-progress-bg"></div>
          <div 
            class="replay-progress-fill"
            style={{ width: `${progress}%` }}
          ></div>
          <div 
            class="replay-progress-thumb"
            style={{ left: `calc(${progress}% - 8px)` }}
          ></div>
        </div>

        <div class="replay-time">
          {formatTime(totalDuration())}
        </div>

        <div class="replay-speed-controls">
          <button
            classList={{ 'replay-speed-btn': true, 'replay-speed-btn-active': playbackSpeed() === 1 }}
            onClick={() => handleSpeedChange(1)}
          >
            1x
          </button>
          <button
            classList={{ 'replay-speed-btn': true, 'replay-speed-btn-active': playbackSpeed() === 2 }}
            onClick={() => handleSpeedChange(2)}
          >
            2x
          </button>
          <button
            classList={{ 'replay-speed-btn': true, 'replay-speed-btn-active': playbackSpeed() === 4 }}
            onClick={() => handleSpeedChange(4)}
          >
            4x
          </button>
        </div>
      </div>
    </div>
  );
}
