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
