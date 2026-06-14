export type TerrainType = 'plain' | 'highland' | 'water';

export type TowerType = 
  | 'arrow'
  | 'magic'
  | 'frost'
  | 'cannon'
  | 'poison'
  | 'amplifier'
  | 'trap'
  | 'arc';

export type TowerBranch = 'a' | 'b';

export type TargetStrategy = 
  | 'nearest'
  | 'lowestHp'
  | 'nearestBase'
  | 'bossFirst'
  | 'strongest';

export type MonsterType = 'normal' | 'elite' | 'boss' | 'flying';

export type EliteAbility = 'stealth' | 'split' | 'regen' | 'shield';

export type BossSkill = 'stomp' | 'summon' | 'rage' | 'immune';

export type ImmuneType = 'physical' | 'magic' | 'none';

export type GameState = 'waiting' | 'preparing' | 'playing' | 'paused' | 'ended';

export type SkillType = 'freeze' | 'meteor' | 'repair' | 'gold';

export interface Position {
  x: number;
  y: number;
}

export interface PathPoint {
  x: number;
  y: number;
}

export interface Tower {
  id: string;
  type: TowerType;
  level: number;
  x: number;
  y: number;
  playerId: string;
  targetStrategy: TargetStrategy;
  branch?: TowerBranch;
  lastAttackTime: number;
  cooldown: number;
  totalCost: number;
  isTrap?: boolean;
  trapCooldown?: number;
  damage: number;
  range: number;
  attackSpeed: number;
}

export interface Monster {
  id: string;
  type: MonsterType;
  hp: number;
  maxHp: number;
  armor: number;
  magicResist: number;
  speed: number;
  baseSpeed: number;
  x: number;
  y: number;
  pathIndex: number;
  pathId: number;
  progress: number;
  gold: number;
  isFlying: boolean;
  isStealthed?: boolean;
  stealthTimer?: number;
  hasShield?: boolean;
  shieldHp?: number;
  regenTimer?: number;
  poisonStacks?: number;
  poisonTimer?: number;
  slowTimer?: number;
  slowAmount?: number;
  eliteAbility?: EliteAbility;
  bossSkills?: BossSkill[];
  immuneType?: ImmuneType;
  immuneTimer?: number;
  isRaging?: boolean;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  color: string;
  assignedPaths: number[];
  areaBounds: { x: number; y: number; width: number; height: number };
  skill: SkillType;
  skillCooldown: number;
  kills: number;
  isConnected: boolean;
  disconnectTimer?: number;
}

export interface GameMap {
  width: number;
  height: number;
  cellSize: number;
  terrain: TerrainType[][];
  paths: PathPoint[][];
  basePosition: Position;
  playerAreas: { playerIndex: number; bounds: { x: number; y: number; width: number; height: number } }[];
  name: string;
  difficulty: string;
}

export interface Game {
  id: string;
  state: GameState;
  map: GameMap;
  players: Player[];
  towers: Tower[];
  monsters: Monster[];
  gold: number;
  lives: number;
  maxLives: number;
  currentWave: number;
  totalWaves: number;
  waveTimer: number;
  isWaveActive: boolean;
  waveMonsterIndex: number;
  spawnTimer: number;
  gameSpeed: number;
  speedVote: { playerId: string; speed: number }[];
  skipWaveVote: string[];
  pings: { id: string; x: number; y: number; playerId: string; timer: number }[];
  elapsedTime: number;
  difficulty: string;
  isEndless: boolean;
  endlessMultiplier: number;
  towerDamageBuffs: Map<string, number>;
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  players: Player[];
  maxPlayers: number;
  game: Game | null;
  selectedMap: string;
  isLocked: boolean;
  createdAt: number;
}

export interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export type ReplayEventType =
  | 'monster-spawn'
  | 'monster-move'
  | 'monster-death'
  | 'tower-build'
  | 'tower-upgrade'
  | 'tower-evolve'
  | 'tower-sell'
  | 'tower-attack'
  | 'skill-use'
  | 'wave-start'
  | 'wave-end'
  | 'game-end'
  | 'gold-change'
  | 'lives-change';

export interface ReplayEventBase {
  type: ReplayEventType;
  timestamp: number;
}

export interface ReplayMonsterSpawnEvent extends ReplayEventBase {
  type: 'monster-spawn';
  monsterId: string;
  monsterType: MonsterType;
  pathId: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  eliteAbility?: EliteAbility;
  bossSkills?: BossSkill[];
  isFlying: boolean;
}

export interface ReplayMonsterMoveEvent extends ReplayEventBase {
  type: 'monster-move';
  monsterId: string;
  x: number;
  y: number;
  pathIndex: number;
  progress: number;
  hp: number;
  isStealthed?: boolean;
  hasShield?: boolean;
  shieldHp?: number;
  poisonStacks?: number;
  slowTimer?: number;
  slowAmount?: number;
  immuneType?: ImmuneType;
  isRaging?: boolean;
}

export interface ReplayMonsterDeathEvent extends ReplayEventBase {
  type: 'monster-death';
  monsterId: string;
  goldReward: number;
}

export interface ReplayTowerBuildEvent extends ReplayEventBase {
  type: 'tower-build';
  towerId: string;
  towerType: TowerType;
  x: number;
  y: number;
  playerId: string;
  cost: number;
}

export interface ReplayTowerUpgradeEvent extends ReplayEventBase {
  type: 'tower-upgrade';
  towerId: string;
  newLevel: number;
  cost: number;
  damage: number;
  range: number;
  attackSpeed: number;
}

export interface ReplayTowerEvolveEvent extends ReplayEventBase {
  type: 'tower-evolve';
  towerId: string;
  branch: TowerBranch;
  cost: number;
}

export interface ReplayTowerSellEvent extends ReplayEventBase {
  type: 'tower-sell';
  towerId: string;
  refund: number;
}

export interface ReplayTowerAttackEvent extends ReplayEventBase {
  type: 'tower-attack';
  towerId: string;
  targetId: string;
  damage: number;
  isAOE?: boolean;
  isDOT?: boolean;
  isSlow?: boolean;
}

export interface ReplaySkillUseEvent extends ReplayEventBase {
  type: 'skill-use';
  playerId: string;
  skillType: SkillType;
  targetX?: number;
  targetY?: number;
}

export interface ReplayWaveStartEvent extends ReplayEventBase {
  type: 'wave-start';
  waveNumber: number;
  isBossWave: boolean;
}

export interface ReplayWaveEndEvent extends ReplayEventBase {
  type: 'wave-end';
  waveNumber: number;
  interestGold: number;
}

export interface ReplayGameEndEvent extends ReplayEventBase {
  type: 'game-end';
  victory: boolean;
  finalWave: number;
}

export interface ReplayGoldChangeEvent extends ReplayEventBase {
  type: 'gold-change';
  newGold: number;
}

export interface ReplayLivesChangeEvent extends ReplayEventBase {
  type: 'lives-change';
  newLives: number;
  lostLives: number;
}

export type ReplayEvent =
  | ReplayMonsterSpawnEvent
  | ReplayMonsterMoveEvent
  | ReplayMonsterDeathEvent
  | ReplayTowerBuildEvent
  | ReplayTowerUpgradeEvent
  | ReplayTowerEvolveEvent
  | ReplayTowerSellEvent
  | ReplayTowerAttackEvent
  | ReplaySkillUseEvent
  | ReplayWaveStartEvent
  | ReplayWaveEndEvent
  | ReplayGameEndEvent
  | ReplayGoldChangeEvent
  | ReplayLivesChangeEvent;

export interface ReplayPlayerInfo {
  name: string;
  color: string;
}

export interface ReplayMarker {
  id: string;
  timestamp: number;
  note: string;
  createdAt: number;
  side?: 'left' | 'right';
}

export interface ReplayPlayerStats {
  playerId: string;
  playerName: string;
  kills: number;
  towersBuilt: number;
  goldSpent: number;
  skillsUsed: number;
}

export interface ReplayGlobalStats {
  aliveMonsters: number;
  totalKills: number;
  livesLost: number;
}

export interface ReplayStats {
  players: ReplayPlayerStats[];
  global: ReplayGlobalStats;
}

export interface ReplayMetadata {
  gameId: string;
  startTime: number;
  endTime: number;
  duration: number;
  mapName: string;
  players: ReplayPlayerInfo[];
  finalWave: number;
  victory: boolean;
  totalEvents: number;
}

export interface ReplayData {
  metadata: ReplayMetadata;
  events: ReplayEvent[];
  markers: ReplayMarker[];
}

export interface ReplaySummary {
  gameId: string;
  startTime: number;
  duration: number;
  mapName: string;
  playerCount: number;
  finalWave: number;
  victory: boolean;
  markers?: ReplayMarker[];
}

export type AchievementCategory = 'kill' | 'build' | 'clear' | 'economy';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  threshold: number;
  isPerSession: boolean;
}

export interface PlayerAchievementProgress {
  id: string;
  currentValue: number;
  unlocked: boolean;
  unlockedAt?: number;
}

export type LeaderboardType = 'kills' | 'waves' | 'wins';

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  score: number;
  rank: number;
}
