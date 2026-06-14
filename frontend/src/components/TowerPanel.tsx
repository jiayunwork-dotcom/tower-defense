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
  const store = useGameContext();
  const game = store.game;

  const canAfford = (type: TowerType) => {
    return (game?.gold || 0) >= TOWER_CONFIG[type].baseCost;
  };

  const selectTower = (type: TowerType) => {
    if (!canAfford(type)) return;
    store.setSelectedTowerType(store.selectedTowerType === type ? null : type);
  };

  return (
    <div>
      <h3 class="panel-title">🏗️ 建造防御塔</h3>
      
      <div class="tower-list">
        {(Object.keys(TOWER_CONFIG) as TowerType[]).map(type => {
          const config = TOWER_CONFIG[type];
          const affordable = canAfford(type);
          const isSelected = store.selectedTowerType === type;

          return (
            <div
              classList={{
                'tower-item': true,
                'selected': isSelected,
                'disabled': !affordable
              }}
              onClick={() => selectTower(type)}
              title={config.description}
            >
              <div 
                class="tower-icon" 
                style={{ background: `${config.color}33`, border: `2px solid ${config.color}` }}
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

      <div class="tower-hint">
        <p>💡 提示:</p>
        <p>• 点击塔类型后在地图上放置</p>
        <p>• 右键取消选择</p>
        <p>• 只能在自己区域内建塔</p>
        <p>• 高地建塔伤害+20%</p>
        <p>• 水域减速怪物但不能建塔</p>
      </div>
    </div>
  );
}
