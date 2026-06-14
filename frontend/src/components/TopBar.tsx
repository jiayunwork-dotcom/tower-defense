import { useGameContext } from '../store/game.store';
import { gameSocket } from '../store/game.store';

export default function TopBar() {
  const store = useGameContext();
  const game = store.game;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const voteSpeed = async (speed: number) => {
    await gameSocket.emit('vote-speed', { speed });
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

        <div class="info-item text-muted">
          <span>⏱️</span>
          <span>{formatTime(game?.elapsedTime || 0)}</span>
        </div>
      </div>

      <div class="flex items-center gap-sm">
        <span class="text-sm text-muted">
          速度: {game?.gameSpeed || 1}x
        </span>
        <div class="flex gap-xs">
          <button 
            class="btn-secondary py-sm px-md text-xs"
            onClick={() => voteSpeed(1)}
          >1x</button>
          <button 
            class="btn-secondary py-sm px-md text-xs"
            onClick={() => voteSpeed(1.5)}
          >1.5x</button>
          <button 
            class="btn-secondary py-sm px-md text-xs"
            onClick={() => voteSpeed(2)}
          >2x</button>
        </div>
      </div>
    </div>
  );
}
