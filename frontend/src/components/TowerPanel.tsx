import { useGameContext } from '../store/game.store';
import { TOWER_CONFIG } from '../constants/game.constants';
import type { TowerType } from '../types/game.types';

const TOWER_ICONS: Record<TowerType, string> = {
  arrow: '🏹',
  magic: '🔮',
  frost: '❄️',
  cannon: '💣',
  poison: '☠️',
  amplifier: '⚡',
  trap: '🪤',
  arc: '⚡'
};

export default function TowerPanel() {
  const { state, setSelectedTowerType } = useGameContext();
  const game = state.game;

  const canAfford = (type: TowerType) => {
    return (game?.gold || 0) >= TOWER_CONFIG[type].baseCost;
  };

  const selectTower = (type: TowerType) => {
    if (!canAfford(type)) return;
    setSelectedTowerType(state.selectedTowerType === type ? null : type);
  };

  return (
    <div>
      <h3 class="panel-title">🏗️ 建造防御塔</h3>
      
      <div class="tower-list">
        {(Object.keys(TOWER_CONFIG) as TowerType[]).map(type => {
          const config = TOWER_CONFIG[type];
          const affordable = canAfford(type);
          const isSelected = state.selectedTowerType === type;

          return (
            <div
              class={`tower-item ${isSelected ? 'selected' : ''} ${!affordable ? 'disabled' : ''}`}
              onclick={() => selectTower(type)}
              title={config.description}
            >
              <div 
                class="tower-icon" 
                style={{ background: config.color + '33', border: `2px solid ${config.color}` }}
              >
                {TOWER_ICONS[type]}
              </div>
              <div class="tower-info">
                <div class="tower-name">{config.name}</div>
                <div class="tower-cost">💰 {config.baseCost}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style="padding: 10px; font-size: 11px; color: rgba(255,255,255,0.5); line-height: 1.5;">
        <p>💡 提示:</p>
        <p>• 点击塔类型后在地图上放置</p>
        <p>• 右键取消选择</p>
        <p>• 只能在自己区域内建塔</p>
        <p>• 高地建塔射程+20%</p>
        <p>• 水域减速怪物但不能建塔</p>
      </div>
    </div>
  );
}
