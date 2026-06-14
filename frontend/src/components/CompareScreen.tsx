import { onMount, onCleanup, createSignal, createMemo, Show, For } from 'solid-js';
import { useGameContext } from '../store/game.store';
import { gameSocket } from '../store/game.store';
import { GameRenderer } from '../utils/game-renderer';
import { ReplayEngine, ReplayState } from '../utils/replay-engine';
import type { ReplayData, ReplayMarker } from '../types/game.types';

interface ReplayInstance {
  canvasRef: HTMLCanvasElement | null;
  renderer: GameRenderer | null;
  engine: ReplayEngine | null;
  state: ReplayState | null;
  isPlaying: boolean;
  speed: number;
  playbackTimeMs: number;
  totalDuration: number;
  markers: ReplayMarker[];
  isLoading: boolean;
  isEnded: boolean;
}

export default function CompareScreen() {
  const store = useGameContext();
  let animationFrame: number = 0;
  let leftCanvasRef: HTMLCanvasElement | null = null;
  let rightCanvasRef: HTMLCanvasElement | null = null;
  let updateSizes: () => void;

  const left: ReplayInstance = {
    canvasRef: null,
    renderer: null,
    engine: null,
    state: null,
    isPlaying: false,
    speed: 1,
    playbackTimeMs: 0,
    totalDuration: 0,
    markers: [],
    isLoading: true,
    isEnded: false,
  };

  const right: ReplayInstance = {
    canvasRef: null,
    renderer: null,
    engine: null,
    state: null,
    isPlaying: false,
    speed: 1,
    playbackTimeMs: 0,
    totalDuration: 0,
    markers: [],
    isLoading: true,
    isEnded: false,
  };

  const [leftPlaying, setLeftPlaying] = createSignal(false);
  const [leftSpeed, setLeftSpeed] = createSignal(1);
  const [leftTime, setLeftTime] = createSignal(0);
  const [leftDuration, setLeftDuration] = createSignal(0);
  const [leftState, setLeftState] = createSignal<ReplayState | null>(null);
  const [leftMarkers, setLeftMarkers] = createSignal<ReplayMarker[]>([]);
  const [leftLoading, setLeftLoading] = createSignal(true);

  const [rightPlaying, setRightPlaying] = createSignal(false);
  const [rightSpeed, setRightSpeed] = createSignal(1);
  const [rightTime, setRightTime] = createSignal(0);
  const [rightDuration, setRightDuration] = createSignal(0);
  const [rightState, setRightState] = createSignal<ReplayState | null>(null);
  const [rightMarkers, setRightMarkers] = createSignal<ReplayMarker[]>([]);
  const [rightLoading, setRightLoading] = createSignal(true);

  const [mainTime, setMainTime] = createSignal(0);
  const [isMainDragging, setIsMainDragging] = createSignal(false);
  const [showMarkerInput, setShowMarkerInput] = createSignal(false);
  const [markerNote, setMarkerNote] = createSignal('');
  const [markerInputSide, setMarkerInputSide] = createSignal<'left' | 'right'>('left');
  const [markerInputTime, setMarkerInputTime] = createSignal(0);
  let markerNoteInputRef: HTMLInputElement | null = null;
  const [hoveredLeftMarker, setHoveredLeftMarker] = createSignal<ReplayMarker | null>(null);
  const [hoveredRightMarker, setHoveredRightMarker] = createSignal<ReplayMarker | null>(null);

  let lastFrameTime: number = 0;

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const mainDuration = createMemo(() => Math.max(leftDuration(), rightDuration()));
  const mainProgress = createMemo(() =>
    mainDuration() > 0 ? (mainTime() / mainDuration()) * 100 : 0
  );

  const sortedLeftMarkers = createMemo(() => [...leftMarkers()].sort((a, b) => a.timestamp - b.timestamp));
  const sortedRightMarkers = createMemo(() => [...rightMarkers()].sort((a, b) => a.timestamp - b.timestamp));

  const initSide = (
    instance: ReplayInstance,
    replayData: ReplayData | null,
    canvas: HTMLCanvasElement | null,
    setters: {
      setDuration: (n: number) => void;
      setState: (s: ReplayState | null) => void;
      setMarkers: (m: ReplayMarker[]) => void;
      setLoading: (b: boolean) => void;
      setTime: (n: number) => void;
    }
  ) => {
    if (!replayData || !canvas) return;
    if (!replayData.markers) (replayData as any).markers = [];

    instance.canvasRef = canvas;
    instance.renderer = new GameRenderer(canvas);
    instance.engine = new ReplayEngine(replayData);
    const duration = instance.engine.getTotalDuration();
    instance.totalDuration = duration;
    setters.setDuration(duration);

    instance.markers = replayData.markers || [];
    setters.setMarkers(replayData.markers || []);

    const initial = instance.engine.getInitialState();
    instance.state = initial;
    instance.playbackTimeMs = 0;
    setters.setState(initial);
    setters.setTime(0);
    instance.isLoading = false;
    setters.setLoading(false);
  };

  const initCompare = () => {
    const leftData = store.leftReplay as ReplayData;
    const rightData = store.rightReplay as ReplayData;

    if (!leftData || !rightData) {
      exitCompare();
      return;
    }

    initSide(left, leftData, leftCanvasRef, {
      setDuration: setLeftDuration,
      setState: setLeftState,
      setMarkers: setLeftMarkers,
      setLoading: setLeftLoading,
      setTime: setLeftTime,
    });

    initSide(right, rightData, rightCanvasRef, {
      setDuration: setRightDuration,
      setState: setRightState,
      setMarkers: setRightMarkers,
      setLoading: setRightLoading,
      setTime: setRightTime,
    });

    setMainTime(0);
  };

  const seekSideTo = (
    instance: ReplayInstance,
    targetTimeMs: number,
    setters: {
      setState: (s: ReplayState | null) => void;
      setTime: (n: number) => void;
      setLoading: (b: boolean) => void;
      setPlaying: (b: boolean) => void;
    }
  ) => {
    if (!instance.engine) return;

    const clampedTime = Math.min(targetTimeMs, instance.totalDuration);
    instance.isLoading = true;
    setters.setLoading(true);
    setters.setPlaying(false);
    instance.isPlaying = false;

    requestAnimationFrame(() => {
      try {
        const newState = instance.engine!.rebuildStateTo(clampedTime);
        instance.state = newState;
        instance.playbackTimeMs = clampedTime;
        setters.setState(newState);
        setters.setTime(clampedTime);
        instance.isEnded = newState.isEnded;
      } finally {
        instance.isLoading = false;
        setters.setLoading(false);
      }
    });
  };

  const seekBothTo = (targetTimeMs: number) => {
    seekSideTo(left, targetTimeMs, {
      setState: setLeftState,
      setTime: setLeftTime,
      setLoading: setLeftLoading,
      setPlaying: setLeftPlaying,
    });
    seekSideTo(right, targetTimeMs, {
      setState: setRightState,
      setTime: setRightTime,
      setLoading: setRightLoading,
      setPlaying: setRightPlaying,
    });
    setMainTime(Math.min(targetTimeMs, mainDuration()));
  };

  const handleMainProgressClick = (e: MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const targetTime = ratio * mainDuration();
    seekBothTo(targetTime);
  };

  const handleMainProgressDrag = (e: MouseEvent) => {
    if (!isMainDragging()) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const targetTime = ratio * mainDuration();
    seekBothTo(targetTime);
  };

  const exitCompare = () => {
    store.setIsInCompareMode(false);
    store.setLeftReplay(null);
    store.setRightReplay(null);
  };

  const toggleSidePlay = (
    instance: ReplayInstance,
    setPlaying: (b: boolean) => void,
    currentPlaying: boolean,
  ) => {
    if (instance.isEnded) return;
    const next = !currentPlaying;
    instance.isPlaying = next;
    setPlaying(next);
  };

  const setSideSpeed = (
    instance: ReplayInstance,
    setSpeed: (n: number) => void,
    speed: number
  ) => {
    instance.speed = speed;
    setSpeed(speed);
  };

  const createMarker = async (
    side: 'left' | 'right',
    note: string,
    timestamp: number,
  ) => {
    const replayData = side === 'left' ? store.leftReplay : store.rightReplay;
    const setMarkers = side === 'left' ? setLeftMarkers : setRightMarkers;
    const markersArr = side === 'left' ? leftMarkers() : rightMarkers();

    if (!replayData) return;
    if (markersArr.length >= 20) {
      store.showToast('最多只能创建20个标记');
      return;
    }

    const result = await gameSocket.emit('add-marker', {
      gameId: replayData.metadata.gameId,
      timestamp,
      note: note.slice(0, 30),
      side,
    });

    if (result && result.success && result.marker) {
      const newMarkers = [...markersArr, result.marker];
      setMarkers(newMarkers);
      if (side === 'left' && store.leftReplay) store.leftReplay.markers = newMarkers;
      if (side === 'right' && store.rightReplay) store.rightReplay.markers = newMarkers;
      store.showToast('标记创建成功');
    } else {
      store.showToast(result?.error || '创建标记失败');
    }
  };

  const openMarkerInput = (side: 'left' | 'right') => {
    const markersArr = side === 'left' ? leftMarkers() : rightMarkers();
    if (markersArr.length >= 20) {
      store.showToast('最多只能创建20个标记');
      return;
    }
    const t = side === 'left' ? leftTime() : rightTime();
    setMarkerInputSide(side);
    setMarkerInputTime(t);
    setMarkerNote('');
    setShowMarkerInput(true);
    setLeftPlaying(false);
    setRightPlaying(false);
    left.isPlaying = false;
    right.isPlaying = false;
    setTimeout(() => {
      if (markerNoteInputRef) markerNoteInputRef.focus();
    }, 50);
  };

  const confirmMarkerInput = () => {
    createMarker(markerInputSide(), markerNote(), markerInputTime());
    setShowMarkerInput(false);
  };

  const cancelMarkerInput = () => {
    setShowMarkerInput(false);
  };

  const handleSideMarkerClick = (marker: ReplayMarker) => {
    const side = marker.side === 'right' ? 'right' : 'left';
    const inst = side === 'left' ? left : right;
    const setters = side === 'left'
      ? { setState: setLeftState, setTime: setLeftTime, setLoading: setLeftLoading, setPlaying: setLeftPlaying }
      : { setState: setRightState, setTime: setRightTime, setLoading: setRightLoading, setPlaying: setRightPlaying };
    seekSideTo(inst, marker.timestamp, setters);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && showMarkerInput()) {
      cancelMarkerInput();
    } else if (e.key === 'Enter' && showMarkerInput()) {
      confirmMarkerInput();
    }
  };

  const advanceSide = (
    instance: ReplayInstance,
    deltaTime: number,
    setters: {
      setState: (s: ReplayState | null) => void;
      setTime: (n: number) => void;
      setPlaying: (b: boolean) => void;
    }
  ) => {
    if (!instance.engine || !instance.state || !instance.isPlaying) return;
    if (instance.playbackTimeMs >= instance.totalDuration) {
      instance.isPlaying = false;
      setters.setPlaying(false);
      return;
    }

    instance.playbackTimeMs += deltaTime * 1000 * instance.speed;
    instance.playbackTimeMs = Math.min(instance.playbackTimeMs, instance.totalDuration);

    const newState = instance.engine.advanceTo(instance.playbackTimeMs, instance.state);
    instance.state = newState;
    setters.setState(newState);
    setters.setTime(instance.playbackTimeMs);

    if (newState.isEnded) {
      instance.isPlaying = false;
      setters.setPlaying(false);
      instance.isEnded = true;
    }
  };

  const renderLoop = (timestamp: number) => {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const deltaTime = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    advanceSide(left, deltaTime, {
      setState: setLeftState,
      setTime: setLeftTime,
      setPlaying: setLeftPlaying,
    });
    advanceSide(right, deltaTime, {
      setState: setRightState,
      setTime: setRightTime,
      setPlaying: setRightPlaying,
    });

    const t = Math.max(left.playbackTimeMs, right.playbackTimeMs);
    setMainTime(t);

    if (left.renderer && left.state && !left.isLoading) {
      left.renderer.render(left.state.game, null, null);
    }
    if (right.renderer && right.state && !right.isLoading) {
      right.renderer.render(right.state.game, null, null);
    }

    animationFrame = requestAnimationFrame(renderLoop);
  };

  onMount(() => {
    leftCanvasRef = leftCanvasRef;
    rightCanvasRef = rightCanvasRef;

    updateSizes = () => {
      if (left.renderer && left.canvasRef?.parentElement) {
        const pw = left.canvasRef.parentElement.clientWidth;
        const ph = left.canvasRef.parentElement.clientHeight;
        left.renderer.resize(pw, ph);
      }
      if (right.renderer && right.canvasRef?.parentElement) {
        const pw = right.canvasRef.parentElement.clientWidth;
        const ph = right.canvasRef.parentElement.clientHeight;
        right.renderer.resize(pw, ph);
      }
    };

    window.addEventListener('resize', updateSizes);
    window.addEventListener('keydown', handleKeyDown);

    initCompare();

    requestAnimationFrame(() => {
      updateSizes();
    });

    lastFrameTime = performance.now();
    animationFrame = requestAnimationFrame(renderLoop);
  });

  onCleanup(() => {
    if (updateSizes) window.removeEventListener('resize', updateSizes);
    window.removeEventListener('keydown', handleKeyDown);
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (left.renderer) left.renderer.destroy();
    if (right.renderer) right.renderer.destroy();
  });

  const leftMeta = store.leftReplay?.metadata;
  const rightMeta = store.rightReplay?.metadata;

  const renderMarker = (
    marker: ReplayMarker,
    duration: number,
    sideLabel: string,
    side: 'left' | 'right',
    hovered: ReplayMarker | null,
    setHovered: (m: ReplayMarker | null) => void
  ) => {
    const percent = duration > 0 ? (marker.timestamp / duration) * 100 : 0;
    return (
      <div
        class={`replay-marker replay-marker-${sideLabel}`}
        style={{ left: `calc(${percent}% - 6px)` }}
        onClick={(e) => {
          e.stopPropagation();
          handleSideMarkerClick(marker);
        }}
        onMouseEnter={() => setHovered(marker)}
        onMouseLeave={() => setHovered(null)}
      >
        <div class="replay-marker-triangle"></div>
        <Show when={hovered?.id === marker.id}>
          <div class="replay-marker-tooltip">
            <div class="replay-marker-tooltip-time">{sideLabel.toUpperCase()} {formatTime(marker.timestamp)}</div>
            <Show when={marker.note}>
              <div class="replay-marker-tooltip-note">{marker.note}</div>
            </Show>
          </div>
        </Show>
      </div>
    );
  };

  return (
    <div class="compare-screen">
      <div class="compare-header">
        <h2 class="replay-title">⚖️ 对比回放模式</h2>
        <button class="btn-secondary" onClick={exitCompare}>
          返回列表
        </button>
      </div>

      <div class="compare-body">
        <div class="compare-side compare-side-left">
          <div class="compare-side-header">
            <div class="compare-side-title">
              <span class="compare-side-badge compare-side-badge-left">左</span>
              {leftMeta && (
                <div class="compare-side-meta">
                  <span class="text-semibold">{leftMeta.mapName}</span>
                  <span class="text-xs text-muted">{leftMeta.players.map(p => p.name).join(', ')}</span>
                  <span class="text-xs">波次 {leftMeta.finalWave}</span>
                  <span classList={{
                    'text-green-600 text-xs': leftMeta.victory,
                    'text-red-600 text-xs': !leftMeta.victory
                  }}>
                    {leftMeta.victory ? '🏆 胜利' : '💀 失败'}
                  </span>
                </div>
              )}
            </div>
            <div class="compare-side-controls">
              <button
                class="replay-btn-play compare-play-btn"
                onClick={() => toggleSidePlay(left, setLeftPlaying, leftPlaying())}
              >
                {leftPlaying() ? '⏸' : '▶'}
              </button>
              <div class="replay-speed-controls">
                <button
                  classList={{ 'replay-speed-btn': true, 'replay-speed-btn-active': leftSpeed() === 1 }}
                  onClick={() => setSideSpeed(left, setLeftSpeed, 1)}
                >1x</button>
                <button
                  classList={{ 'replay-speed-btn': true, 'replay-speed-btn-active': leftSpeed() === 2 }}
                  onClick={() => setSideSpeed(left, setLeftSpeed, 2)}
                >2x</button>
                <button
                  classList={{ 'replay-speed-btn': true, 'replay-speed-btn-active': leftSpeed() === 4 }}
                  onClick={() => setSideSpeed(left, setLeftSpeed, 4)}
                >4x</button>
              </div>
              <button class="btn-secondary compare-marker-btn" onClick={() => openMarkerInput('left')} title="为左侧创建标记">
                📍 左标记
              </button>
              <span class="compare-time">{formatTime(leftTime())}</span>
            </div>
          </div>

          <div class="game-canvas-container compare-canvas-container">
            <canvas
              ref={(el) => { leftCanvasRef = el; left.canvasRef = el; }}
              class="game-canvas"
            />
            {leftLoading() && (
              <div class="replay-loading-overlay">
                <div class="replay-loading-spinner"></div>
                <p>正在重建游戏状态...</p>
              </div>
            )}
            {leftState() && (
              <div class="replay-hud">
                <div class="replay-hud-item"><span class="text-gold">💰</span><span>{leftState()!.game.gold}</span></div>
                <div class="replay-hud-item"><span class="text-red">❤️</span><span>{leftState()!.game.lives}/{leftState()!.game.maxLives}</span></div>
                <div class="replay-hud-item"><span class="text-blue">🌊</span><span>第{leftState()!.game.currentWave}波</span></div>
              </div>
            )}
          </div>

          <div class="compare-side-progress">
            <div
              class="replay-progress-container compare-progress"
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const x = e.clientX - rect.left;
                const ratio = x / rect.width;
                seekSideTo(left, ratio * leftDuration(), {
                  setState: setLeftState, setTime: setLeftTime,
                  setLoading: setLeftLoading, setPlaying: setLeftPlaying,
                });
              }}
            >
              <div class="replay-progress-bg"></div>
              <div class="replay-progress-fill" style={{ width: `${leftDuration() > 0 ? (leftTime() / leftDuration()) * 100 : 0}%` }}></div>
              <For each={sortedLeftMarkers()}>
                {(m) => renderMarker(m, leftDuration(), 'L', 'left', hoveredLeftMarker(), setHoveredLeftMarker)}
              </For>
              <div class="replay-progress-thumb" style={{ left: `calc(${leftDuration() > 0 ? (leftTime() / leftDuration()) * 100 : 0}% - 8px)` }}></div>
            </div>
          </div>
        </div>

        <div class="compare-divider"></div>

        <div class="compare-side compare-side-right">
          <div class="compare-side-header">
            <div class="compare-side-title">
              <span class="compare-side-badge compare-side-badge-right">右</span>
              {rightMeta && (
                <div class="compare-side-meta">
                  <span class="text-semibold">{rightMeta.mapName}</span>
                  <span class="text-xs text-muted">{rightMeta.players.map(p => p.name).join(', ')}</span>
                  <span class="text-xs">波次 {rightMeta.finalWave}</span>
                  <span classList={{
                    'text-green-600 text-xs': rightMeta.victory,
                    'text-red-600 text-xs': !rightMeta.victory
                  }}>
                    {rightMeta.victory ? '🏆 胜利' : '💀 失败'}
                  </span>
                </div>
              )}
            </div>
            <div class="compare-side-controls">
              <button
                class="replay-btn-play compare-play-btn"
                onClick={() => toggleSidePlay(right, setRightPlaying, rightPlaying())}
              >
                {rightPlaying() ? '⏸' : '▶'}
              </button>
              <div class="replay-speed-controls">
                <button
                  classList={{ 'replay-speed-btn': true, 'replay-speed-btn-active': rightSpeed() === 1 }}
                  onClick={() => setSideSpeed(right, setRightSpeed, 1)}
                >1x</button>
                <button
                  classList={{ 'replay-speed-btn': true, 'replay-speed-btn-active': rightSpeed() === 2 }}
                  onClick={() => setSideSpeed(right, setRightSpeed, 2)}
                >2x</button>
                <button
                  classList={{ 'replay-speed-btn': true, 'replay-speed-btn-active': rightSpeed() === 4 }}
                  onClick={() => setSideSpeed(right, setRightSpeed, 4)}
                >4x</button>
              </div>
              <button class="btn-secondary compare-marker-btn" onClick={() => openMarkerInput('right')} title="为右侧创建标记">
                📍 右标记
              </button>
              <span class="compare-time">{formatTime(rightTime())}</span>
            </div>
          </div>

          <div class="game-canvas-container compare-canvas-container">
            <canvas
              ref={(el) => { rightCanvasRef = el; right.canvasRef = el; }}
              class="game-canvas"
            />
            {rightLoading() && (
              <div class="replay-loading-overlay">
                <div class="replay-loading-spinner"></div>
                <p>正在重建游戏状态...</p>
              </div>
            )}
            {rightState() && (
              <div class="replay-hud">
                <div class="replay-hud-item"><span class="text-gold">💰</span><span>{rightState()!.game.gold}</span></div>
                <div class="replay-hud-item"><span class="text-red">❤️</span><span>{rightState()!.game.lives}/{rightState()!.game.maxLives}</span></div>
                <div class="replay-hud-item"><span class="text-blue">🌊</span><span>第{rightState()!.game.currentWave}波</span></div>
              </div>
            )}
          </div>

          <div class="compare-side-progress">
            <div
              class="replay-progress-container compare-progress"
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const x = e.clientX - rect.left;
                const ratio = x / rect.width;
                seekSideTo(right, ratio * rightDuration(), {
                  setState: setRightState, setTime: setRightTime,
                  setLoading: setRightLoading, setPlaying: setRightPlaying,
                });
              }}
            >
              <div class="replay-progress-bg"></div>
              <div class="replay-progress-fill" style={{ width: `${rightDuration() > 0 ? (rightTime() / rightDuration()) * 100 : 0}%` }}></div>
              <For each={sortedRightMarkers()}>
                {(m) => renderMarker(m, rightDuration(), 'R', 'right', hoveredRightMarker(), setHoveredRightMarker)}
              </For>
              <div class="replay-progress-thumb" style={{ left: `calc(${rightDuration() > 0 ? (rightTime() / rightDuration()) * 100 : 0}% - 8px)` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div class="compare-controls">
        <div class="compare-main-label">主进度条（同步跳转）</div>
        <div class="replay-time">{formatTime(mainTime())}</div>
        <div
          class="replay-progress-container compare-main-progress"
          onClick={handleMainProgressClick}
          onMouseDown={() => setIsMainDragging(true)}
          onMouseUp={() => setIsMainDragging(false)}
          onMouseLeave={() => setIsMainDragging(false)}
          onMouseMove={handleMainProgressDrag}
        >
          <div class="replay-progress-bg"></div>
          <div class="replay-progress-fill" style={{ width: `${mainProgress()}%` }}></div>

          <For each={sortedLeftMarkers()}>
            {(m) => {
              const percent = mainDuration() > 0 ? (m.timestamp / mainDuration()) * 100 : 0;
              return (
                <div
                  class="replay-marker replay-marker-left"
                  style={{ left: `calc(${percent}% - 6px)` }}
                  onClick={(e) => { e.stopPropagation(); handleSideMarkerClick({ ...m, side: 'left' }); }}
                >
                  <div class="replay-marker-triangle"></div>
                </div>
              );
            }}
          </For>
          <For each={sortedRightMarkers()}>
            {(m) => {
              const percent = mainDuration() > 0 ? (m.timestamp / mainDuration()) * 100 : 0;
              return (
                <div
                  class="replay-marker replay-marker-right"
                  style={{ left: `calc(${percent}% - 6px)` }}
                  onClick={(e) => { e.stopPropagation(); handleSideMarkerClick({ ...m, side: 'right' }); }}
                >
                  <div class="replay-marker-triangle"></div>
                </div>
              );
            }}
          </For>

          <div class="replay-progress-thumb" style={{ left: `calc(${mainProgress()}% - 8px)` }}></div>
        </div>
        <div class="replay-time">{formatTime(mainDuration())}</div>

        <div class="compare-legend">
          <span class="compare-legend-item">
            <span class="replay-marker replay-marker-left inline-marker"><span class="replay-marker-triangle"></span></span>
            左侧标记
          </span>
          <span class="compare-legend-item">
            <span class="replay-marker replay-marker-right inline-marker"><span class="replay-marker-triangle"></span></span>
            右侧标记
          </span>
        </div>
      </div>

      <Show when={showMarkerInput()}>
        <div class="modal-overlay" onClick={cancelMarkerInput}>
          <div class="modal-dialog marker-input-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 class="modal-title marker-modal-title">
              📍 创建{markerInputSide() === 'left' ? '左侧' : '右侧'}精彩标记
            </h3>
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
