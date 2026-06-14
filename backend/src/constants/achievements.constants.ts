import { AchievementDef } from '../types/game.types';

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'kill_100',
    name: '初露锋芒',
    description: '累计击杀100只怪物',
    icon: '⚔️',
    category: 'kill',
    threshold: 100,
    isPerSession: false,
  },
  {
    id: 'kill_500',
    name: '百战百胜',
    description: '累计击杀500只怪物',
    icon: '🗡️',
    category: 'kill',
    threshold: 500,
    isPerSession: false,
  },
  {
    id: 'kill_1000',
    name: '屠戮之王',
    description: '累计击杀1000只怪物',
    icon: '💀',
    category: 'kill',
    threshold: 1000,
    isPerSession: false,
  },
  {
    id: 'build_10',
    name: '初级建筑师',
    description: '单局建造10座塔',
    icon: '🏗️',
    category: 'build',
    threshold: 10,
    isPerSession: true,
  },
  {
    id: 'build_20',
    name: '中级建筑师',
    description: '单局建造20座塔',
    icon: '🏰',
    category: 'build',
    threshold: 20,
    isPerSession: true,
  },
  {
    id: 'build_30',
    name: '高级建筑师',
    description: '单局建造30座塔',
    icon: '🏯',
    category: 'build',
    threshold: 30,
    isPerSession: true,
  },
  {
    id: 'clear_normal',
    name: '普通征服者',
    description: '通关普通难度',
    icon: '🥉',
    category: 'clear',
    threshold: 1,
    isPerSession: false,
  },
  {
    id: 'clear_hard',
    name: '困难征服者',
    description: '通关困难难度',
    icon: '🥈',
    category: 'clear',
    threshold: 1,
    isPerSession: false,
  },
  {
    id: 'clear_hell',
    name: '地狱征服者',
    description: '通关地狱难度',
    icon: '🥇',
    category: 'clear',
    threshold: 1,
    isPerSession: false,
  },
  {
    id: 'economy_2000',
    name: '小有积蓄',
    description: '单局累计花费2000金币',
    icon: '💰',
    category: 'economy',
    threshold: 2000,
    isPerSession: true,
  },
  {
    id: 'economy_5000',
    name: '富甲一方',
    description: '单局累计花费5000金币',
    icon: '💎',
    category: 'economy',
    threshold: 5000,
    isPerSession: true,
  },
  {
    id: 'economy_10000',
    name: '富可敌国',
    description: '单局累计花费10000金币',
    icon: '👑',
    category: 'economy',
    threshold: 10000,
    isPerSession: true,
  },
];

export const ACHIEVEMENT_MAP: Map<string, AchievementDef> = new Map(
  ACHIEVEMENTS.map(a => [a.id, a])
);

export const ACHIEVEMENTS_BY_CATEGORY: Record<string, AchievementDef[]> = {
  kill: ACHIEVEMENTS.filter(a => a.category === 'kill'),
  build: ACHIEVEMENTS.filter(a => a.category === 'build'),
  clear: ACHIEVEMENTS.filter(a => a.category === 'clear'),
  economy: ACHIEVEMENTS.filter(a => a.category === 'economy'),
};

export const ACHIEVEMENT_REDIS_KEY_PREFIX = 'td:achievement:';
export const PLAYER_SESSION_STATS_PREFIX = 'td:session:';
export const LEADERBOARD_KEY_PREFIX = 'td:leaderboard:';
export const PLAYER_NAME_KEY_PREFIX = 'td:playername:';
