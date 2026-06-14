import { useGameContext, gameSocket } from '../store/game.store';
import { TOWER_CONFIG, TARGET_STRATEGIES } from '../constants/game.constants';
import type { TargetStrategy } from '../types/game.types';

export default function TowerDetail() {
  const store = useGameContext();
  const game = store.game;

  const tower = () => game?.towers.find(t => t.id === store.selectedTowerId);
  const config = () => tower() ? TOWER_CONFIG[tower()!.type] : null;

  const upgradeCost = () => {
    if (!tower() || !config() || tower()!.level >= 3) return 0;
    return tower()!.level === 1 
      ? Math.floor(config()!.baseCost * 0.6) 
      : config()!.baseCost;
  };

  const evolveCost = () => {
    if (!tower() || !config() || tower()!.level < 3 || tower()!.branch) return 0;
    return Math.floor(config()!.baseCost * 1.5);
  };

  const canUpgrade = () => {
    if (!tower() || !game) return false;
    return tower()!.level < 3 && game.gold >= upgradeCost();
  };

  const canEvolve = () => {
    if (!tower() || !game) return false;
    return tower()!.level >= 3 && !tower()!.branch && game.gold >= evolveCost();
  };

  const upgradeTower = async () => {
    if (!tower()) return;
    await gameSocket.emit('upgrade-tower', { towerId: tower()!.id });
  };

  const evolveTower = async (branch: 'a' | 'b') => {
    if (!tower()) return;
    await gameSocket.emit('evolve-tower', { towerId: tower()!.id, branch });
  };

  const sellTower = async () => {
    if (!tower()) return;
    await gameSocket.emit('sell-tower', { towerId: tower()!.id });
    store.setSelectedTowerId(null);
  };

  const changeStrategy = async (strategy: TargetStrategy) => {
    if (!tower()) return;
    await gameSocket.emit('set-tower-strategy', { towerId: tower()!.id, strategy });
  };

  const sellValue = () => {
    if (!tower()) return 0;
    return Math.floor(tower()!.totalCost * 0.8);
  };

  const towerIcon = (type: string) => {
    switch (type) {
      case 'arrow': return '🏹';
      case 'magic': return '🔮';
      case 'frost': return '❄️';
      case 'cannon': return '💣';
      case 'poison': return '☠️';
      case 'amplifier': return '⚡';
      case 'trap': return '🪤';
      case 'arc': return '⚡';
      default: return '🏗️';
    }
  };

  if (!tower() || !config()) return null;

  const t = tower()!;
  const c = config()!;

  return (
    <div class="tower-detail-panel">
      <div class="tower-detail-header">
        <div 
          style={{
            width: '40px',
            height: '40px',
            'border-radius': '50%',
            background: c.color,
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'font-size': '20px'
          }}
        >
          {towerIcon(t.type)}
        </div>
        <div>
          <div class="text-bold text-md">
            {c.name}
            {t.branch && (
              <span class="text-gold ml-sm">
                [{t.branch === 'a' ? c.branches.a.name : c.branches.b.name}]
              </span>
            )}
          </div>
          <div class="text-xs text-muted">
            等级 {t.level}/3
          </div>
        </div>
      </div>

      <div class="tower-detail-stats">
        <div>⚔️ 伤害: {Math.floor(t.damage)}</div>
        <div>🎯 射程: {t.range.toFixed(1)}</div>
        <div>⚡ 攻速: {t.attackSpeed.toFixed(2)}/秒</div>
        {c.isAOE && <div>💥 范围伤害</div>}
        {c.isAntiAir && <div>✈️ 对空有效</div>}
        {c.isSlow && <div>❄️ 减速效果</div>}
        {c.isDOT && <div>☠️ 持续伤害</div>}
        {c.ignoresArmor && <div>🛡️ 无视护甲</div>}
        {t.isTrap && <div>🪤 陷阱</div>}
        {c.isAmplifier && <div>🔋 强化塔</div>}
      </div>

      <div class="mb-md">
        <div class="text-xs mb-xs text-muted">
          攻击策略:
        </div>
        <select
          class="strategy-select"
          value={t.targetStrategy}
          onChange={(e) => changeStrategy((e.target as HTMLSelectElement).value as TargetStrategy)}
        >
          {(Object.keys(TARGET_STRATEGIES) as TargetStrategy[]).map(strategy => (
            <option value={strategy}>
              {TARGET_STRATEGIES[strategy].name}
            </option>
          ))}
        </select>
      </div>

      <div class="tower-detail-actions">
        {t.level < 3 && (
          <button 
            class="btn-primary w-full"
            onClick={upgradeTower}
            disabled={!canUpgrade()}
          >
            升级 (💰 {upgradeCost()})
          </button>
        )}

        {t.level >= 3 && !t.branch && (
          <>
            <button 
              class="btn-gold w-full text-xs"
              onClick={() => evolveTower('a')}
              disabled={!canEvolve()}
            >
              进化A: {c.branches.a.name} (💰 {evolveCost()})
            </button>
            <button 
              class="btn-gold w-full text-xs"
              onClick={() => evolveTower('b')}
              disabled={!canEvolve()}
            >
              进化B: {c.branches.b.name} (💰 {evolveCost()})
            </button>
          </>
        )}

        <button 
          class="btn-danger w-full"
          onClick={sellTower}
        >
          出售 (返还 💰 {sellValue()})
        </button>

        <button 
          class="btn-secondary w-full"
          onClick={() => store.setSelectedTowerId(null)}
        >
          关闭
        </button>
      </div>
    </div>
  );
}
