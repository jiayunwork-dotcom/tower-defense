import { useGameContext, gameSocket } from '../store/game.store';
import { TOWER_CONFIG, TARGET_STRATEGIES } from '../constants/game.constants';
import type { TargetStrategy } from '../types/game.types';

export default function TowerDetail() {
  const { state, setSelectedTowerId } = useGameContext();
  const game = state.game;
  
  const tower = () => game?.towers.find(t => t.id === state.selectedTowerId);
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
    const result = await gameSocket.emit('upgrade-tower', { towerId: tower()!.id });
    if (result.success) {
      // Tower upgraded
    }
  };

  const evolveTower = async (branch: 'a' | 'b') => {
    if (!tower()) return;
    const result = await gameSocket.emit('evolve-tower', { towerId: tower()!.id, branch });
    if (result.success) {
      // Tower evolved
    }
  };

  const sellTower = async () => {
    if (!tower()) return;
    const result = await gameSocket.emit('sell-tower', { towerId: tower()!.id });
    if (result.success) {
      setSelectedTowerId(null);
    }
  };

  const changeStrategy = async (strategy: TargetStrategy) => {
    if (!tower()) return;
    await gameSocket.emit('set-tower-strategy', { towerId: tower()!.id, strategy });
  };

  const sellValue = () => {
    if (!tower()) return 0;
    return Math.floor(tower()!.totalCost * 0.8);
  };

  if (!tower() || !config()) return null;

  return (
    <div class="tower-detail-panel">
      <div class="tower-detail-header">
        <div 
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: config()!.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20
          }}
        >
          {tower()!.type === 'arrow' ? '🏹' : 
           tower()!.type === 'magic' ? '🔮' :
           tower()!.type === 'frost' ? '❄️' :
           tower()!.type === 'cannon' ? '💣' :
           tower()!.type === 'poison' ? '☠️' :
           tower()!.type === 'amplifier' ? '⚡' :
           tower()!.type === 'trap' ? '🪤' : '⚡'}
        </div>
        <div>
          <div style="font-weight: 700; font-size: 15px;">
            {config()!.name}
            {tower()!.branch && <span style="color: #fbbf24; margin-left: 6px;">
              [{tower()!.branch === 'a' ? config()!.branches.a.name : config()!.branches.b.name}]
            </span>}
          </div>
          <div style="font-size: 12px; color: rgba(255,255,255,0.6);">
            等级 {tower()!.level}/3
          </div>
        </div>
      </div>

      <div class="tower-detail-stats">
        <div>⚔️ 伤害: {Math.floor(tower()!.damage)}</div>
        <div>🎯 射程: {tower()!.range.toFixed(1)}</div>
        <div>⚡ 攻速: {tower()!.attackSpeed.toFixed(2)}/秒</div>
        {config()!.isAOE && <div>💥 范围伤害</div>}
        {config()!.isAntiAir && <div>✈️ 对空有效</div>}
        {config()!.isSlow && <div>❄️ 减速效果</div>}
        {config()!.isDOT && <div>☠️ 持续伤害</div>}
        {config()!.ignoresArmor && <div>🛡️ 无视护甲</div>}
        {tower()!.isTrap && <div>🪤 陷阱</div>}
        {config()!.isAmplifier && <div>🔋 强化塔</div>}
      </div>

      <div style="margin-bottom: 12px;">
        <div style="font-size: 12px; margin-bottom: 6px; color: rgba(255,255,255,0.7);">
          攻击策略:
        </div>
        <select
          class="strategy-select"
          value={tower()!.targetStrategy}
          onchange={(e) => changeStrategy(e.target.value as TargetStrategy)}
        >
          {(Object.keys(TARGET_STRATEGIES) as TargetStrategy[]).map(strategy => (
            <option value={strategy}>
              {TARGET_STRATEGIES[strategy].name}
            </option>
          ))}
        </select>
      </div>

      <div class="tower-detail-actions">
        {tower()!.level < 3 && (
          <button 
            class="btn-primary"
            onclick={upgradeTower}
            disabled={!canUpgrade()}
            style="width: 100%;"
          >
            升级 (💰 {upgradeCost()})
          </button>
        )}

        {tower()!.level >= 3 && !tower()!.branch && (
          <>
            <button 
              class="btn-gold"
              onclick={() => evolveTower('a')}
              disabled={!canEvolve()}
              style="width: 100%; font-size: 12px;"
            >
              进化A: {config()!.branches.a.name} (💰 {evolveCost()})
            </button>
            <button 
              class="btn-gold"
              onclick={() => evolveTower('b')}
              disabled={!canEvolve()}
              style="width: 100%; font-size: 12px;"
            >
              进化B: {config()!.branches.b.name} (💰 {evolveCost()})
            </button>
          </>
        )}

        <button 
          class="btn-danger"
          onclick={sellTower}
          style="width: 100%;"
        >
          出售 (返还 💰 {sellValue()})
        </button>

        <button 
          class="btn-secondary"
          onclick={() => setSelectedTowerId(null)}
          style="width: 100%;"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
