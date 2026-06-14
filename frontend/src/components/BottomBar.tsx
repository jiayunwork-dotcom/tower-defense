import { useGameContext, gameSocket } from '../store/game.store';
import { SKILLS, PLAYER_COLORS } from '../constants/game.constants';
import type { SkillType } from '../types/game.types';

export default function BottomBar() {
  const store = useGameContext();
  const game = store.game;

  const useSkill = async (skill: SkillType) => {
    const player = game?.players.find(p => p.id === store.playerId);
    if (!player || player.skill !== skill || player.skillCooldown > 0) return;
    
    if (skill === 'meteor') {
      const centerX = game!.map.width / 2;
      const centerY = game!.map.height / 2;
      await gameSocket.emit('use-skill', { skill, targetX: centerX, targetY: centerY });
    } else {
      await gameSocket.emit('use-skill', { skill });
    }
  };

  const currentPlayer = () => game?.players.find(p => p.id === store.playerId);

  return (
    <div class="bottom-bar">
      <div class="player-list">
        {game?.players.map((player, index) => {
          const colorIdx = index % PLAYER_COLORS.length;
          const isOwnSkill = currentPlayer()?.id === player.id;
          const onCooldown = player.skillCooldown > 0;
          const cooldownPercent = player.skillCooldown 
            ? (player.skillCooldown / SKILLS[player.skill].cooldown) * 100 
            : 0;

          return (
            <div 
              class={`player-card game-player-card p-${colorIdx}`}
              style={{ opacity: player.isConnected ? 1 : 0.5 }}
            >
              <div 
                class="player-avatar"
                style={{ background: PLAYER_COLORS[colorIdx] }}
              >
                {player.name.charAt(0).toUpperCase()}
              </div>
              <div class="player-info">
                <div class="player-name">
                  {player.name}
                  {player.isHost && ' 👑'}
                </div>
                <div class="player-stats">
                  击杀: {player.kills} | 技能: {SKILLS[player.skill]?.name}
                </div>
              </div>
              {isOwnSkill && onCooldown && (
                <div class="text-xs text-warning ml-sm">
                  {Math.ceil(player.skillCooldown)}s
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div class="flex gap-sm">
        {(Object.keys(SKILLS) as SkillType[]).map(skill => {
          const player = currentPlayer();
          const isOwnSkill = player?.skill === skill;
          const onCooldown = player?.skillCooldown && player.skillCooldown > 0;
          const cooldownPercent = player?.skillCooldown 
            ? (player.skillCooldown / SKILLS[skill].cooldown) * 100 
            : 0;

          return (
            <button
              classList={{
                'game-skill-btn': true,
                'btn-secondary': !isOwnSkill,
                'btn-gold': isOwnSkill,
                'disabled': !isOwnSkill || onCooldown
              }}
              onClick={() => isOwnSkill && !onCooldown && useSkill(skill)}
              disabled={!isOwnSkill || onCooldown}
              title={`${SKILLS[skill].name}: ${SKILLS[skill].description}`}
            >
              {isOwnSkill && onCooldown && (
                <div 
                  class="skill-cooldown-overlay"
                  style={{ height: `${cooldownPercent}%` }}
                />
              )}
              <div class="skill-btn-content">
                <div class="skill-icon">{SKILLS[skill].icon}</div>
                <div class="skill-name">{SKILLS[skill].name}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
