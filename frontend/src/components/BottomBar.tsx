import { useGameContext, gameSocket } from '../store/game.store';
import { SKILLS, PLAYER_COLORS } from '../constants/game.constants';
import type { SkillType } from '../types/game.types';

export default function BottomBar() {
  const { state } = useGameContext();
  const game = state.game;

  const useSkill = async (skill: SkillType) => {
    const player = game?.players.find(p => p.id === state.playerId);
    if (!player || player.skill !== skill || player.skillCooldown > 0) return;
    
    if (skill === 'meteor') {
      const centerX = game!.map.width / 2;
      const centerY = game!.map.height / 2;
      await gameSocket.emit('use-skill', { skill, targetX: centerX, targetY: centerY });
    } else {
      await gameSocket.emit('use-skill', { skill });
    }
  };

  const currentPlayer = () => game?.players.find(p => p.id === state.playerId);

  return (
    <div class="bottom-bar">
      <div class="player-list">
        {game?.players.map((player, index) => (
          <div 
            class="player-card" 
            style={{
              borderTop: `3px solid ${PLAYER_COLORS[index % PLAYER_COLORS.length]}`,
              opacity: player.isConnected ? 1 : 0.5
            }}
          >
            <div 
              class="player-avatar" 
              style={{ background: PLAYER_COLORS[index % PLAYER_COLORS.length] }}
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
            {player.skillCooldown > 0 && (
              <div style={{ fontSize: '11px', color: '#f59e0b', marginLeft: '8px' }}>
                {Math.ceil(player.skillCooldown)}s
              </div>
            )}
          </div>
        ))}
      </div>

      <div style="display: flex; gap: 10px;">
        {(Object.keys(SKILLS) as SkillType[]).map(skill => {
          const player = currentPlayer();
          const isOwnSkill = player?.skill === skill;
          const onCooldown = player?.skillCooldown && player.skillCooldown > 0;
          const cooldownPercent = player?.skillCooldown 
            ? (player.skillCooldown / SKILLS[skill].cooldown) * 100 
            : 0;

          return (
            <button
              class={isOwnSkill ? 'btn-gold' : 'btn-secondary'}
              style={{
                minWidth: '70px',
                opacity: isOwnSkill ? 1 : 0.5,
                position: 'relative',
                overflow: 'hidden'
              }}
              onclick={() => isOwnSkill && !onCooldown && useSkill(skill)}
              disabled={!isOwnSkill || onCooldown}
              title={`${SKILLS[skill].name}: ${SKILLS[skill].description}`}
            >
              {isOwnSkill && onCooldown && (
                <div 
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: `${cooldownPercent}%`,
                    background: 'rgba(0,0,0,0.4)',
                    transition: 'height 0.1s linear'
                  }}
                />
              )}
              <div style={{ fontSize: '20px', position: 'relative', zIndex: 1 }}>
                {SKILLS[skill].icon}
              </div>
              <div style={{ fontSize: '10px', position: 'relative', zIndex: 1 }}>
                {SKILLS[skill].name}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
