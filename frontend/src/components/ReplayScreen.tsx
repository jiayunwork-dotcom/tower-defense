import { onMount, onCleanup, createSignal, createMemo, Show, For } from 'solid-js';
import { useGameContext } from '../store/game.store';
import { gameSocket } from '../store/game.store';
import { GameRenderer } from '../utils/game-renderer';
import { ReplayEngine, ReplayState } from '../utils/replay-engine';
import type { ReplayData, ReplayMarker, ReplayStats } from '../types/game.types';

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
  const [markers, setMarkers] = createSignal<ReplayMarker[]>([]);
  const [statsPanelOpen, setStatsPanelOpen] = createSignal(false);
  const [showMarkerInput, setShowMarkerInput] = createSignal(false);
  const [markerNote, setMarkerNote] = createSignal('');
  const [markerInputTime, setMarkerInputTime] = createSignal(0);
  const [hoveredMarker, setHoveredMarker] = createSignal<ReplayMarker | null>(null);

  let replayEngine: ReplayEngine | null = null;
  let lastFrameTime: number = 0;
  let playbackTimeMs: number = 0;
  let markerNoteInputRef: HTMLInputElement | null = null;

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const initReplay = () => {
    const replayData = store.currentReplay as ReplayData;
    if (!replayData) {
      store.setIsInReplayMode(false);
      store.setCurrentReplay(null);
      return;
    }

    if (!replayData.markers) {
      (replayData as any).markers = [];
    }

    replayEngine = new ReplayEngine(replayData);
    const totalDurationMs = replayEngine.getTotalDuration();
    setTotalDuration(totalDurationMs);

    setMarkers(replayData.markers || []);

    const startTime = store.replayStartTimeMs || 0;
    store.setReplayStartTimeMs(0);

    if (startTime > 0) {
      setIsLoading(true);
      requestAnimationFrame(() => {
        const initState = replayEngine!.getInitialState();
        const targetMs = Math.min(startTime, totalDurationMs);
        const newState = replayEngine!.rebuildStateTo(targetMs);
        setReplayState(newState);
        playbackTimeMs = targetMs;
        setCurrentTime(targetMs);
        setIsLoading(false);
      });
    } else {
      const initialState = replayEngine.getInitialState();
      setReplayState(initialState);
      playbackTimeMs = 0;
      setCurrentTime(0);
      setIsLoading(false);
    }
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

  const createMarker = async (note: string, timestamp: number) => {
    const replayData = store.currentReplay as ReplayData;
    if (!replayData || !replayEngine) return;

    if (markers().length >= 20) {
      store.showToast('最多只能创建20个标记');
      return;
    }

    const result = await gameSocket.emit('add-marker', {
      gameId: replayData.metadata.gameId,
      timestamp,
      note: note.slice(0, 30),
    });

    if (result && result.success && result.marker) {
      const newMarkers = [...markers(), result.marker];
      setMarkers(newMarkers);
      if (store.currentReplay) {
        store.currentReplay.markers = newMarkers;
      }
      store.showToast('标记创建成功');
    } else {
      store.showToast(result?.error || '创建标记失败');
    }
  };

  const openMarkerInput = () => {
    if (markers().length >= 20) {
      store.showToast('最多只能创建20个标记');
      return;
    }
    setMarkerInputTime(currentTime());
    setMarkerNote('');
    setShowMarkerInput(true);
    setTimeout(() => {
      if (markerNoteInputRef) {
        markerNoteInputRef.focus();
      }
    }, 50);
  };

  const confirmMarkerInput = () => {
    createMarker(markerNote(), markerInputTime());
    setShowMarkerInput(false);
  };

  const cancelMarkerInput = () => {
    setShowMarkerInput(false);
  };

  const handleMarkerClick = (marker: ReplayMarker) => {
    seekTo(marker.timestamp);
  };

  const shareReplay = async () => {
    const replayData = store.currentReplay as ReplayData;
    if (!replayData) return;

    const gameId = replayData.metadata.gameId;
    const timeSeconds = Math.floor(currentTime() / 1000);
    const shareLink = `replay?id=${encodeURIComponent(gameId)}&t=${timeSeconds}`;

    try {
      await navigator.clipboard.writeText(shareLink);
      store.showToast('已复制分享链接');
    } catch (e) {
      const textarea = document.createElement('textarea');
      textarea.value = shareLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      store.showToast('已复制分享链接');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'm' || e.key === 'M') {
      if (!showMarkerInput()) {
        pause();
        openMarkerInput();
      }
    } else if (e.key === ' ' && !showMarkerInput()) {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'Escape' && showMarkerInput()) {
      cancelMarkerInput();
    } else if (e.key === 'Enter' && showMarkerInput()) {
      confirmMarkerInput();
    }
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
      window.addEventListener('keydown', handleKeyDown);
      
      initReplay();
      lastFrameTime = performance.now();
      animationFrame = requestAnimationFrame(renderLoop);
    }
  });

  onCleanup(() => {
    if (updateSize) {
      window.removeEventListener('resize', updateSize);
    }
    window.removeEventListener('keydown', handleKeyDown);
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    if (renderer) {
      renderer.destroy();
    }
  });

  const metadata = store.currentReplay?.metadata;
  const progress = createMemo(() => 
    totalDuration() > 0 ? (currentTime() / totalDuration()) * 100 : 0
  );

  const sortedMarkers = createMemo(() => [...markers()].sort((a, b) => a.timestamp - b.timestamp));

  const currentStats = createMemo<ReplayStats | null>(() => replayState()?.stats || null);

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
        <div class="flex gap-sm items-center">
          <button class="btn-secondary replay-action-btn" onClick={shareReplay} title="分享精彩时刻">
            🔗 分享精彩时刻
          </button>
          <button class="btn-secondary replay-action-btn" onClick={openMarkerInput} title="按M键快速创建标记">
            📍 创建标记 (M)
          </button>
          <button class="btn-secondary" onClick={exitReplay}>
            返回大厅
          </button>
        </div>
      </div>

      <div class="replay-body">
        <div 
          classList={{
            'game-canvas-container replay-canvas-container': true,
            'replay-canvas-with-panel': statsPanelOpen()
          }}
        >
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

          <button
            classList={{
              'stats-panel-toggle': true,
              'stats-panel-toggle-open': statsPanelOpen()
            }}
            onClick={() => setStatsPanelOpen(!statsPanelOpen())}
            title={statsPanelOpen() ? '收起统计面板' : '展开统计面板'}
          >
            {statsPanelOpen() ? '▶' : '◀ 统计'}
          </button>
        </div>

        <Show when={statsPanelOpen()}>
          <div class="stats-panel">
            <div class="stats-panel-header">
              <h3>📊 实时统计</h3>
              <span class="text-xs text-muted">
                截至 {formatTime(currentTime())}
              </span>
            </div>

            <Show when={currentStats()}>
              <div class="stats-section">
                <h4 class="stats-section-title">全局数据</h4>
                <div class="stats-global-grid">
                  <div class="stat-card">
                    <div class="stat-label">存活怪物</div>
                    <div class="stat-value text-warning">{currentStats()!.global.aliveMonsters}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">击杀总数</div>
                    <div class="stat-value text-danger">{currentStats()!.global.totalKills}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">损失生命</div>
                    <div class="stat-value text-danger">{currentStats()!.global.livesLost}</div>
                  </div>
                </div>
              </div>

              <div class="stats-section">
                <h4 class="stats-section-title">玩家数据</h4>
                <For each={currentStats()!.players}>
                  {(playerStat) => (
                    <div class="stats-player-card">
                      <div class="stats-player-name">{playerStat.playerName}</div>
                      <div class="stats-player-grid">
                        <div class="stat-mini">
                          <span class="stat-mini-label">击杀</span>
                          <span class="stat-mini-value text-danger">{playerStat.kills}</span>
                        </div>
                        <div class="stat-mini">
                          <span class="stat-mini-label">建塔</span>
                          <span class="stat-mini-value text-primary">{playerStat.towersBuilt}</span>
                        </div>
                        <div class="stat-mini">
                          <span class="stat-mini-label">花费</span>
                          <span class="stat-mini-value text-gold">{playerStat.goldSpent}</span>
                        </div>
                        <div class="stat-mini">
                          <span class="stat-mini-label">技能</span>
                          <span class="stat-mini-value text-success">{playerStat.skillsUsed}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>
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
            style={{ width: `${progress()}%` }}
          ></div>
          
          <For each={sortedMarkers()}>
            {(marker) => {
              const markerPercent = totalDuration() > 0 ? (marker.timestamp / totalDuration()) * 100 : 0;
              return (
                <div
                  class="replay-marker"
                  style={{ left: `calc(${markerPercent}% - 6px)` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkerClick(marker);
                  }}
                  onMouseEnter={() => setHoveredMarker(marker)}
                  onMouseLeave={() => setHoveredMarker(null)}
                >
                  <div class="replay-marker-triangle"></div>
                  <Show when={hoveredMarker()?.id === marker.id}>
                    <div class="replay-marker-tooltip">
                      <div class="replay-marker-tooltip-time">{formatTime(marker.timestamp)}</div>
                      <Show when={marker.note}>
                        <div class="replay-marker-tooltip-note">{marker.note}</div>
                      </Show>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>

          <div 
            class="replay-progress-thumb"
            style={{ left: `calc(${progress()}% - 8px)` }}
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

      <Show when={showMarkerInput()}>
        <div class="modal-overlay" onClick={cancelMarkerInput}>
          <div class="modal-dialog marker-input-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 class="modal-title marker-modal-title">📍 创建精彩标记</h3>
            <div class="marker-input-time">
              时间点: {formatTime(markerInputTime())}
            </div>
            <div class="marker-input-note">
              <label>备注文字 (可选，最多30字)</label>
              <input
                ref={(el) => { markerNoteInputRef = el; }}
                type="text"
                maxlength={30}
                placeholder="输入备注内容..."
                value={markerNote()}
                onInput={(e) => setMarkerNote(e.target.value)}
              />
              <div class="marker-char-count">{markerNote().length}/30</div>
            </div>
            <div class="modal-actions">
              <button class="btn-secondary" onClick={cancelMarkerInput}>取消</button>
              <button class="btn-primary" onClick={confirmMarkerInput}>确定</button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
