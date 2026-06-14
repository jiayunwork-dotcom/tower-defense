import { onMount, onCleanup, createSignal } from 'solid-js';
import { useGameContext, gameSocket } from '../store/game.store';
import { GameRenderer } from '../utils/game-renderer';
import TopBar from './TopBar';
import BottomBar from './BottomBar';
import TowerPanel from './TowerPanel';
import TowerDetail from './TowerDetail';
import GameOverPanel from './GameOverPanel';
import type { TowerType, SkillType } from '../types/game.types';

export default function GameScreen() {
  const { state, setSelectedTowerType, setSelectedTowerId } = useGameContext();
  let canvasRef: HTMLCanvasElement | null = null;
  let renderer: GameRenderer | null = null;
  let animationFrame: number = 0;

  const [mousePos, setMousePos] = createSignal({ x: 0, y: 0 });
  const [chatInput, setChatInput] = createSignal('');

  const renderLoop = () => {
    if (renderer && state.game) {
      renderer.render(state.game, state.selectedTowerType, state.selectedTowerId);
    }
    animationFrame = requestAnimationFrame(renderLoop);
  };

  const handleCanvasClick = (e: MouseEvent) => {
    if (!canvasRef || !renderer || !state.game) return;

    const rect = canvasRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const worldPos = renderer.screenToWorld(x, y);
    const gridPos = renderer.worldToGrid(worldPos.x, worldPos.y);

    if (state.selectedTowerType) {
      buildTower(state.selectedTowerType, gridPos.gridX, gridPos.gridY);
    } else {
      selectTowerAt(gridPos.gridX, gridPos.gridY);
    }
  };

  const handleCanvasRightClick = (e: MouseEvent) => {
    e.preventDefault();
    setSelectedTowerType(null);
    setSelectedTowerId(null);
  };

  const buildTower = async (type: TowerType, x: number, y: number) => {
    const result = await gameSocket.emit('build-tower', { type, x, y });
    if (result.success) {
      // Tower built successfully
    }
  };

  const selectTowerAt = (gridX: number, gridY: number) => {
    const tower = state.game?.towers.find(t => 
      Math.floor(t.x) === gridX && Math.floor(t.y) === gridY
    );
    if (tower) {
      setSelectedTowerId(tower.id);
    } else {
      setSelectedTowerId(null);
    }
  };

  const handleCanvasMouseMove = (e: MouseEvent) => {
    if (!canvasRef) return;
    const rect = canvasRef.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const sendChat = async () => {
    if (!chatInput().trim()) return;
    await gameSocket.emit('chat-message', { message: chatInput() });
    setChatInput('');
  };

  const useSkill = async (skill: SkillType) => {
    if (state.game?.players.find(p => p.id === state.playerId)?.skillCooldown !== 0) return;
    
    if (skill === 'meteor') {
      // TODO: 让玩家选择目标位置
      const centerX = state.game!.map.width / 2;
      const centerY = state.game!.map.height / 2;
      await gameSocket.emit('use-skill', { skill, targetX: centerX, targetY: centerY });
    } else {
      await gameSocket.emit('use-skill', { skill });
    }
  };

  const skipWave = async () => {
    await gameSocket.emit('skip-wave');
  };

  const currentPlayer = () => state.game?.players.find(p => p.id === state.playerId);

  let updateSize: () => void;

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
            ref={canvasRef!}
            class="game-canvas"
            onclick={handleCanvasClick}
            oncontextmenu={handleCanvasRightClick}
            onmousemove={handleCanvasMouseMove}
          />
          
          {!state.game?.isWaveActive && state.game && state.game.state === 'playing' && (
            <div class="wave-preview">
              下一波: 第 {state.game.currentWave + 1} 波 | 
              倒计时: {Math.ceil(state.game.waveTimer)}秒
              <button 
                class="btn-gold" 
                style="margin-left: 12px; padding: 4px 12px; font-size: 12px;"
                onclick={skipWave}
              >
                跳过等待 ({state.game.skipWaveVote.length}/{state.game.players.filter(p => p.isConnected).length})
              </button>
            </div>
          )}

          {state.selectedTowerId && state.game && (
            <TowerDetail />
          )}

          {state.chatMessages.length > 0 && (
            <div class="chat-box">
              {state.chatMessages.slice(-5).map((msg, i) => (
                <div class="chat-message" key={i}>
                  <span style="color: #3b82f6; font-weight: 600;">{msg.playerName}: </span>
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
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div class="side-panel">
          <TowerPanel />
        </div>
      </div>
      
      <BottomBar />
      
      {state.game?.state === 'ended' && <GameOverPanel />}
    </div>
  );
}
