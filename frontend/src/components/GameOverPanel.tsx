import { useGameContext } from '../store/game.store';

export default function GameOverPanel() {
  const store = useGameContext();
  const game = store.game;

  const isVictory = () => {
    if (!game) return false;
    return game.lives > 0 && (
      (game.currentWave >= game.totalWaves && !game.isWaveActive && game.monsters.length === 0)
      || (!game.isEndless && game.currentWave >= game.totalWaves)
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}分${secs}秒`;
  };

  if (!game || game.state !== 'ended') return null;

  const victory = isVictory() || (game.lives > 0 && !game.isEndless);

  const backToLobby = () => {
    store.setRoom(null);
    store.setGame(null);
  };

  return (
    <div class="game-over-panel">
      <h2 class={`game-over-title ${victory ? 'victory' : 'defeat'}`}>
        {victory ? '🎉 胜利！' : '💀 失败...'}
      </h2>
      
      <div class="mb-lg">
        <p class="text-md mb-sm">坚持到了第 <span class="text-bold text-primary">{game.currentWave}</span> 波</p>
        <p class="text-md mb-sm">用时: <span class="text-bold">{formatTime(game.elapsedTime)}</span></p>
        <p class="text-md mb-sm">
          剩余生命: 
          <span class={`text-bold ${game.lives > 10 ? 'text-success' : 'text-danger'}`}>
            {' '}{game.lives}
          </span>
        </p>
        <p class="text-md">剩余金币: <span class="text-bold text-gold">{Math.floor(game.gold)}</span></p>
      </div>

      <div class="game-over-stats">
        <h4 class="mb-sm text-semibold">🏆 战绩统计</h4>
        {game.players.map((player) => (
          <div class="game-over-stats-row" key={player.id}>
            <span>{player.name}</span>
            <span class="text-gold">击杀: {player.kills}</span>
          </div>
        ))}
      </div>

      <div class="flex gap-md justify-center">
        <button class="btn-primary" onClick={backToLobby}>
          返回大厅
        </button>
      </div>
    </div>
  );
}
