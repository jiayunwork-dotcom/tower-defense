import { onMount, onCleanup, createSignal } from 'solid-js';
import { useGameContext, gameSocket } from '../store/game.store';
import { GameRenderer } from '../utils/game-renderer';
import TopBar from './TopBar';
import BottomBar from './BottomBar';
import TowerPanel from './TowerPanel';
import TowerDetail from './TowerDetail';
import GameOverPanel from './GameOverPanel';
import type { TowerType } from '../types/game.types';

export default function GameScreen() {
  const store = useGameContext();
  let canvasRef: HTMLCanvasElement | null = null;
  let renderer: GameRenderer | null = null;
  let animationFrame: number = 0;
  let updateSize: () => void;

  const [chatInput, setChatInput] = createSignal('');

  const renderLoop = () => {
    if (renderer && store.game) {
      renderer.render(store.game, store.selectedTowerType, store.selectedTowerId);
    }
    animationFrame = requestAnimationFrame(renderLoop);
  };

  const handleCanvasClick = (e: MouseEvent) => {
    if (!canvasRef || !renderer || !store.game) return;

    const rect = canvasRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const worldPos = renderer.screenToWorld(x, y);
    const gridPos = renderer.worldToGrid(worldPos.x, worldPos.y);

    console.log('[GameScreen] Click at grid:', gridPos, 'world:', worldPos);

    if (store.selectedTowerType) {
      buildTower(store.selectedTowerType, gridPos.gridX, gridPos.gridY);
    } else {
      selectTowerAt(gridPos.gridX, gridPos.gridY);
    }
  };

  const handleCanvasRightClick = (e: MouseEvent) => {
    e.preventDefault();
    store.setSelectedTowerType(null);
    store.setSelectedTowerId(null);
  };

  const buildTower = async (type: TowerType, x: number, y: number) => {
    console.log('[GameScreen] Building tower:', type, 'at', x, y);
    const result = await gameSocket.emit('build-tower', { type, x, y });
    if (!result.success) {
      console.warn('[GameScreen] Build tower failed:', result.error);
    } else {
      store.setSelectedTowerType(null);
    }
  };

  const selectTowerAt = (gridX: number, gridY: number) => {
    const tower = store.game?.towers.find(t => 
      Math.floor(t.x) === gridX && Math.floor(t.y) === gridY
    );
    console.log('[GameScreen] Selected tower:', tower);
    if (tower) {
      store.setSelectedTowerId(tower.id);
    } else {
      store.setSelectedTowerId(null);
    }
  };

  const sendChat = async () => {
    if (!chatInput().trim()) return;
    await gameSocket.emit('chat-message', { message: chatInput() });
    setChatInput('');
  };

  const skipWave = async () => {
    await gameSocket.emit('skip-wave');
  };

  const connectedPlayerCount = () => {
    return store.game?.players.filter(p => p.isConnected).length || 0;
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
      
      renderLoop();
    } else {
      console.error('[GameScreen] canvasRef is null!');
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

  return (
    <div class="game-screen">
      <TopBar />
      
      <div class="game-body">
        <div class="game-canvas-container">
          <canvas
            ref={(el) => { canvasRef = el; }}
            class="game-canvas"
            onClick={handleCanvasClick}
            onContextMenu={handleCanvasRightClick}
          />
          
          {!store.game?.isWaveActive && store.game && store.game.state === 'playing' && (
            <div class="wave-preview">
              下一波: 第 {store.game.currentWave + 1} 波 | 
              倒计时: {Math.ceil(store.game.waveTimer)}秒
              <button 
                class="btn-gold" 
                classList={{ 'ml-sm': true, 'py-xs': true, 'px-md': true, 'text-xs': true }}
                onClick={skipWave}
              >
                跳过等待 ({store.game.skipWaveVote.length}/{connectedPlayerCount()})
              </button>
            </div>
          )}

          {store.selectedTowerId && store.game && (
            <TowerDetail />
          )}

          {store.chatMessages.length > 0 && (
            <div class="chat-box">
              {store.chatMessages.slice(-5).map((msg, i) => (
                <div class="chat-message" key={i}>
                  <span class="text-primary text-semibold">{msg.playerName}: </span>
                  {msg.message}
                </div>
              ))}
            </div>
          )}

          <div class="chat-input">
            <input
              type="text"
              placeholder="输入消息... (Enter发送)"
              value={chatInput()}
              onInput={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              class="w-full"
            />
          </div>
        </div>

        <div class="side-panel">
          <TowerPanel />
        </div>
      </div>
      
      <BottomBar />
      
      {store.game?.state === 'ended' && <GameOverPanel />}
    </div>
  );
}
