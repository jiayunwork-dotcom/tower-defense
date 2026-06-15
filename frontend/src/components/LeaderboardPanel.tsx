import { createSignal, For, createEffect, on } from 'solid-js';
import { useGameContext } from '../store/game.store';
import type { LeaderboardEntry, LeaderboardType, LeaderboardScope } from '../types/game.types';

type TabType = 'kills' | 'waves' | 'wins';

export default function LeaderboardPanel() {
  const store = useGameContext();
  const [activeTab, setActiveTab] = createSignal<TabType>('kills');

  const tabLabels: Record<TabType, string> = {
    kills: '击杀榜',
    waves: '波次榜',
    wins: '胜场榜',
  };

  const scopeLabels: Record<LeaderboardScope, string> = {
    season: '本赛季',
    alltime: '历史总榜',
  };

  const handleScopeChange = (scope: LeaderboardScope) => {
    store.setLeaderboardScope(scope);
  };

  const hasData = (): boolean => {
    const scope = store.leaderboardScope;
    switch (activeTab()) {
      case 'kills':
        return scope === 'season' 
          ? store.seasonLeaderboardKills.length > 0 
          : store.leaderboardKills.length > 0;
      case 'waves':
        return scope === 'season' 
          ? store.seasonLeaderboardWaves.length > 0 
          : store.leaderboardWaves.length > 0;
      case 'wins':
        return scope === 'season' 
          ? store.seasonLeaderboardWins.length > 0 
          : store.leaderboardWins.length > 0;
      default:
        return false;
    }
  };

  const getEntries = (): LeaderboardEntry[] => {
    const scope = store.leaderboardScope;
    switch (activeTab()) {
      case 'kills':
        return scope === 'season' ? store.seasonLeaderboardKills : store.leaderboardKills;
      case 'waves':
        return scope === 'season' ? store.seasonLeaderboardWaves : store.leaderboardWaves;
      case 'wins':
        return scope === 'season' ? store.seasonLeaderboardWins : store.leaderboardWins;
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

  const renderTrend = (trend?: 'up' | 'down' | 'same') => {
    if (!trend || trend === 'same') return null;
    if (trend === 'up') {
      return <span class="trend-arrow trend-up">▲</span>;
    }
    return <span class="trend-arrow trend-down">▼</span>;
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  createEffect(on(
    [() => activeTab(), () => store.leaderboardScope],
    ([tab, scope]) => {
      store.fetchLeaderboard(tab, scope as LeaderboardScope);
    }
  ));

  return (
    <div class="leaderboard-panel">
      <div class="leaderboard-scope-tabs">
        {(['season', 'alltime'] as LeaderboardScope[]).map(scope => (
          <button
            class={`leaderboard-scope-tab ${store.leaderboardScope === scope ? 'active' : ''}`}
            onClick={() => handleScopeChange(scope)}
          >
            {scopeLabels[scope]}
          </button>
        ))}
      </div>
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
          {(entry) => (
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
              <div class="leaderboard-value">
                {formatValue(entry.score)}
                {renderTrend(entry.trend)}
              </div>
            </div>
          )}
        </For>
        {!hasData() && (
          <div class="leaderboard-empty">
            暂无排行数据
          </div>
        )}
      </div>
    </div>
  );
}
