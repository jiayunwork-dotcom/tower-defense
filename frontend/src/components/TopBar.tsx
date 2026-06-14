import { useGameContext } from '../store/game.store';

export default function TopBar() {
  const { state } = useGameContext();
  const game = state.game;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div class="top-bar">
      <div class="top-bar-info">
        <div class="info-item wave">
          <span>🌊</span>
          <span>
            第 {game?.currentWave || 0} 波
            {game && !game.isEndless && ` / ${game.totalWaves}`}
          </span>
        </div>
        
        <div class="info-item lives">
          <span>❤️</span>
          <span>{game?.lives || 0} / {game?.maxLives || 20}</span>
        </div>
        
        <div class="info-item gold">
          <span>💰</span>
          <span>{Math.floor(game?.gold || 0)}</span>
        </div>

        <div class="info-item" style="color: rgba(255,255,255,0.7);">
          <span>⏱️</span>
          <span>{formatTime(game?.elapsedTime || 0)}</span>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 13px; color: rgba(255,255,255,0.6);">
          速度: {game?.gameSpeed || 1}x
        </span>
        <button 
          class="btn-secondary" 
          style="padding: 6px 12px; font-size: 12px;"
          onclick={() => {}}
        >
          ⚙️ 速度
        </button>
      </div>
    </div>
  );
}
