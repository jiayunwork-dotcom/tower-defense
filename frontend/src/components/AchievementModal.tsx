import { For, createEffect, createSignal, onCleanup } from 'solid-js';
import { useGameContext } from '../store/game.store';
import type { PlayerAchievementProgress, AchievementDef, AchievementRarity } from '../types/game.types';

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: 'kill_100', name: '初露锋芒', description: '累计击杀100只怪物', icon: '⚔️', category: 'kill', threshold: 100, isPerSession: false },
  { id: 'kill_500', name: '百战百胜', description: '累计击杀500只怪物', icon: '🗡️', category: 'kill', threshold: 500, isPerSession: false },
  { id: 'kill_1000', name: '屠戮之王', description: '累计击杀1000只怪物', icon: '💀', category: 'kill', threshold: 1000, isPerSession: false },
  { id: 'build_10', name: '初级建筑师', description: '单局建造10座塔', icon: '🏗️', category: 'build', threshold: 10, isPerSession: true },
  { id: 'build_20', name: '中级建筑师', description: '单局建造20座塔', icon: '🏰', category: 'build', threshold: 20, isPerSession: true },
  { id: 'build_30', name: '高级建筑师', description: '单局建造30座塔', icon: '🏯', category: 'build', threshold: 30, isPerSession: true },
  { id: 'clear_normal', name: '普通征服者', description: '通关普通难度', icon: '🥉', category: 'clear', threshold: 1, isPerSession: false },
  { id: 'clear_hard', name: '困难征服者', description: '通关困难难度', icon: '🥈', category: 'clear', threshold: 1, isPerSession: false },
  { id: 'clear_hell', name: '地狱征服者', description: '通关地狱难度', icon: '🥇', category: 'clear', threshold: 1, isPerSession: false },
  { id: 'economy_2000', name: '小有积蓄', description: '单局累计花费2000金币', icon: '💰', category: 'economy', threshold: 2000, isPerSession: true },
  { id: 'economy_5000', name: '富甲一方', description: '单局累计花费5000金币', icon: '💎', category: 'economy', threshold: 5000, isPerSession: true },
  { id: 'economy_10000', name: '富可敌国', description: '单局累计花费10000金币', icon: '👑', category: 'economy', threshold: 10000, isPerSession: true },
];

const RARITY_LABELS: Record<AchievementRarity, string> = {
  common: '常见',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

function formatCountdown(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${days}天 ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function AchievementModal() {
  const store = useGameContext();
  const [countdown, setCountdown] = createSignal<number>(0);
  let timerInterval: number | null = null;

  const getProgress = (achievementId: string): PlayerAchievementProgress | null => {
    return store.achievements.find(a => a.id === achievementId) || null;
  };

  const unlockedCount = () => {
    return ACHIEVEMENT_DEFS.filter(def => {
      const progress = getProgress(def.id);
      return progress?.unlocked;
    }).length;
  };

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString('zh-CN');
  };

  const handleClose = () => {
    store.setShowAchievementModal(false);
  };

  const tickCountdown = () => {
    if (store.seasonInfo) {
      const elapsed = Math.floor((Date.now() - store.seasonInfo.nowTime) / 1000);
      const remaining = Math.max(0, store.seasonInfo.remainingSeconds - elapsed);
      setCountdown(remaining);
      if (remaining === 0) {
        store.fetchAchievements();
      }
    }
  };

  createEffect(() => {
    if (store.showAchievementModal) {
      store.fetchAchievements();
      tickCountdown();
      timerInterval = window.setInterval(tickCountdown, 1000);
    } else {
      if (timerInterval) {
        window.clearInterval(timerInterval);
        timerInterval = null;
      }
    }
  });

  onCleanup(() => {
    if (timerInterval) {
      window.clearInterval(timerInterval);
    }
  });

  return (
    <div class={`modal-overlay ${store.showAchievementModal ? 'active' : ''}`} onClick={handleClose}>
      <div class="modal achievement-modal" onClick={e => e.stopPropagation()}>
        <div class="modal-header">
          <h2>我的成就</h2>
          <div class="achievement-stats">
            已解锁 <span class="highlight">{unlockedCount()}</span> / 12
          </div>
          <button class="modal-close" onClick={handleClose}>×</button>
        </div>
        <div class="season-info-bar">
          <div class="season-info-left">
            <span class="season-icon">🏆</span>
            <span class="season-label">第 <strong>{store.seasonInfo?.seasonNumber ?? '-'}</strong> 赛季</span>
          </div>
          <div class="season-countdown">
            <span class="countdown-label">赛季结束倒计时：</span>
            <span class="countdown-value">{formatCountdown(countdown)}</span>
          </div>
        </div>
        <div class="modal-body">
          <div class="achievement-grid">
            <For each={ACHIEVEMENT_DEFS}>
              {(def) => {
                const progress = getProgress(def.id);
                const unlocked = progress?.unlocked || false;
                const currentValue = progress?.currentValue || 0;
                const percent = Math.min(100, Math.floor((currentValue / def.threshold) * 100));
                const rarity = progress?.rarity || 'common';

                return (
                  <div class={`achievement-card ${unlocked ? 'unlocked' : 'locked'}`}>
                    <div class={`rarity-tag rarity-${rarity}`}>
                      {RARITY_LABELS[rarity]}
                    </div>
                    <div class="achievement-icon">{def.icon}</div>
                    <div class="achievement-name">{def.name}</div>
                    <div class="achievement-desc">{def.description}</div>
                    {unlocked ? (
                      <div class="achievement-unlocked-date">
                        {formatDate(progress?.unlockedAt)}
                      </div>
                    ) : (
                      <div class="achievement-progress">
                        <div class="progress-bar">
                          <div class="progress-fill" style={{ width: `${percent}%` }}></div>
                        </div>
                        <div class="progress-text">
                          {currentValue} / {def.threshold}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
}
