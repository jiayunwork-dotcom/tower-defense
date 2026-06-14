import { useGameContext } from '../store/game.store';

export default function GameOverPanel() {
  const { state } = useGameContext();
  const game = state.game;

  const isVictory = () => {
    if (!game) return false;
    return game.lives > 0 && game.currentWave >= game.totalWaves && !game.isWaveActive && game.monsters.length === 0;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}分${secs}秒`;
  };

  const getTopKiller = () => {
    if (!game) return null;
    let top = game.players[0];
    for (const p of game.players) {
      if (p.kills > top.kills) top = p;
    }
    return top;
  };

  if (!game || game.state !== 'ended') return null;

  const victory = isVictory() || (game.lives > 0 && !game.isEndless);

  return (
    <div class="game-over-panel">
      <h2 class={`game-over-title ${victory ? 'victory' : 'defeat'}`}>
        {victory ? '🎉 胜利！' : '💀 失败...'}
      </h2>
      
      <div style="margin-bottom: 24px;">
        <p>坚持到了第 <strong>{game.currentWave}</strong> 波</p>
        <p>用时: <strong>{formatTime(game.elapsedTime)}</strong></p>
        <p>剩余生命: <strong style="color: {game.lives > 10 ? '#22c55e' : '#ef4444'}">{game.lives}</strong></p>
        <p>剩余金币: <strong style="color: #fbbf24;">{Math.floor(game.gold)}</strong></p>
      </div>

      <div style="margin-bottom: 24px; text-align: left; padding: 16px; background: rgba(255,255,255,0.05); border-radius: 8px;">
        <h4 style="margin-bottom: 12px;">🏆 战绩统计</h4>
        {game.players.map((player, i) => (
          <div key={player.id} style="display: flex; justify-content: space-between; padding: 4px 0;">
            <span>{player.name}</span>
            <span>击杀: {player.kills}</span>
          </div>
        ))}
      </div>

      <div style="display: flex; gap: 12px; justify-content: center;">
        <button class="btn-primary" onclick={() => window.location.reload()}>
          返回大厅
        </button>
      </div>
    </div>
  );
}
