import { createSignal, For, createEffect, onMount } from 'solid-js';
import { useGameContext } from '../store/game.store';
import type { LeaderboardEntry, LeaderboardType } from '../types/game.types';

type TabType = 'kills' | 'waves' | 'wins';

export default function LeaderboardPanel() {
  const store = useGameContext();
  const [activeTab, setActiveTab] = createSignal<TabType>('kills');

  const tabLabels: Record<TabType, string> = {
    kills: '击杀榜',
    waves: '波次榜',
    wins: '胜场榜',
  };

  const getEntries = (): LeaderboardEntry[] => {
    switch (activeTab()) {
      case 'kills':
        return store.leaderboardKills;
      case 'waves':
        return store.leaderboardWaves;
      case 'wins':
        return store.leaderboardWins;
      default:
        return [];
    }
  };

  const isCurrentPlayer = (playerId: string): boolean => {
    return playerId === store.playerId;
  };

  const formatValue = (value: number): string => {
    switch (activeTab()) {
      case 'kills':
        return `${value} 击杀`;
      case 'waves':
        return `第 ${value} 波`;
      case 'wins':
        return `${value} 胜`;
      default:
        return String(value);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  onMount(() => {
    store.fetchLeaderboard('kills');
  });

  createEffect(() => {
    store.fetchLeaderboard(activeTab());
  });

  return (
    <div class="leaderboard-panel">
      <div class="leaderboard-tabs">
        {(['kills', 'waves', 'wins'] as TabType[]).map(tab => (
          <button
            class={`leaderboard-tab ${activeTab() === tab ? 'active' : ''}`}
            onClick={() => handleTabChange(tab)}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>
      <div class="leaderboard-list">
        <For each={getEntries()}>
          {(entry, index) => (
            <div 
              class={`leaderboard-item ${isCurrentPlayer(entry.playerId) ? 'current-player' : ''}`}
            >
              <div class="leaderboard-rank">
                {entry.rank <= 3 ? (
                  <span class={`rank-medal rank-${entry.rank}`}>{['🥇', '🥈', '🥉'][entry.rank - 1]}</span>
                ) : (
                  <span class="rank-number">{entry.rank}</span>
                )}
              </div>
              <div class="leaderboard-name">{entry.playerName}</div>
              <div class="leaderboard-value">{formatValue(entry.score)}</div>
            </div>
          )}
        </For>
        {getEntries().length === 0 && (
          <div class="leaderboard-empty">
            暂无排行数据
          </div>
        )}
      </div>
    </div>
  );
}
