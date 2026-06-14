import type {
  Game,
  Tower,
  Monster,
  ReplayData,
  ReplayEvent,
  ReplayMonsterSpawnEvent,
  ReplayMonsterMoveEvent,
  ReplayMonsterDeathEvent,
  ReplayTowerBuildEvent,
  ReplayTowerUpgradeEvent,
  ReplayTowerEvolveEvent,
  ReplayTowerSellEvent,
  ReplayWaveStartEvent,
  ReplayWaveEndEvent,
  ReplayGameEndEvent,
  ReplayGoldChangeEvent,
  ReplayLivesChangeEvent,
  GameMap,
  Player,
} from '../types/game.types';
import { TOWER_CONFIG, MONSTER_CONFIG, INITIAL_LIVES, PLAYER_COLORS } from '../constants/game.constants';
import { getMapByName } from '../config/maps.config';
import { CELL_SIZE } from '../constants/game.constants';

export interface ReplayState {
  game: Game;
  currentEventIndex: number;
  currentTime: number;
  isEnded: boolean;
}

export class ReplayEngine {
  private replayData: ReplayData;
  private monstersMap: Map<string, Monster> = new Map();
  private towersMap: Map<string, Tower> = new Map();
  private eventIndex: number = 0;
  private currentTimeMs: number = 0;
  private baseGameState: Game;

  constructor(replayData: ReplayData) {
    this.replayData = replayData;
    this.baseGameState = this.createInitialGameState();
  }

  private createInitialGameState(): Game {
    const map = getMapByName(this.replayData.metadata.mapName, CELL_SIZE);
    if (!map) throw new Error('Map not found');

    const isEndless = this.replayData.metadata.mapName === 'endless';
    const totalWaves = isEndless ? Infinity : this.replayData.metadata.mapName === 'hell' ? 50 : 30;

    const players: Player[] = this.replayData.metadata.players.map((p, i) => ({
      id: `replay_player_${i}`,
      name: p.name,
      isHost: i === 0,
      isReady: true,
      color: p.color || PLAYER_COLORS[i % PLAYER_COLORS.length],
      assignedPaths: [],
      areaBounds: map.playerAreas[i]?.bounds || { x: 0, y: 0, width: 20, height: 30 },
      skill: 'freeze',
      skillCooldown: 0,
      kills: 0,
      isConnected: true,
    }));

    return {
      id: this.replayData.metadata.gameId,
      state: 'playing',
      map,
      players,
      towers: [],
      monsters: [],
      gold: 0,
      lives: INITIAL_LIVES,
      maxLives: INITIAL_LIVES,
      currentWave: 0,
      totalWaves,
      waveTimer: 0,
      isWaveActive: false,
      waveMonsterIndex: 0,
      spawnTimer: 0,
      gameSpeed: 1,
      speedVote: [],
      skipWaveVote: [],
      pings: [],
      elapsedTime: 0,
      difficulty: map.difficulty,
      isEndless,
      endlessMultiplier: 1,
      towerDamageBuffs: new Map(),
    };
  }

  getInitialState(): ReplayState {
    return {
      game: { ...this.baseGameState, towers: [], monsters: [] },
      currentEventIndex: 0,
      currentTime: 0,
      isEnded: false,
    };
  }

  rebuildStateTo(targetTimeMs: number): ReplayState {
    const startTime = performance.now();
    
    this.eventIndex = 0;
    this.currentTimeMs = 0;
    this.monstersMap.clear();
    this.towersMap.clear();

    const game = { ...this.baseGameState, towers: [], monsters: [] };

    const events = this.replayData.events;
    while (this.eventIndex < events.length) {
      const event = events[this.eventIndex];
      if (event.timestamp > targetTimeMs) break;

      this.processEvent(event, game);
      this.currentTimeMs = event.timestamp;
      this.eventIndex++;
    }

    game.monsters = Array.from(this.monstersMap.values());
    game.towers = Array.from(this.towersMap.values());
    game.elapsedTime = this.currentTimeMs / 1000;

    const rebuildTime = performance.now() - startTime;
    console.log(`[ReplayEngine] Rebuilt state to ${targetTimeMs}ms in ${rebuildTime.toFixed(2)}ms, processed ${this.eventIndex} events`);

    return {
      game,
      currentEventIndex: this.eventIndex,
      currentTime: this.currentTimeMs,
      isEnded: this.eventIndex >= events.length,
    };
  }

  advanceTo(targetTimeMs: number, currentState: ReplayState): ReplayState {
    const game = { ...currentState.game };
    let eventIndex = currentState.currentEventIndex;
    let currentTime = currentState.currentTime;

    const events = this.replayData.events;
    while (eventIndex < events.length) {
      const event = events[eventIndex];
      if (event.timestamp > targetTimeMs) break;

      this.processEvent(event, game);
      currentTime = event.timestamp;
      eventIndex++;
    }

    game.monsters = Array.from(this.monstersMap.values());
    game.towers = Array.from(this.towersMap.values());
    game.elapsedTime = currentTime / 1000;

    return {
      game,
      currentEventIndex: eventIndex,
      currentTime,
      isEnded: eventIndex >= events.length,
    };
  }

  private processEvent(event: ReplayEvent, game: Game): void {
    switch (event.type) {
      case 'monster-spawn':
        this.handleMonsterSpawn(event, game);
        break;
      case 'monster-move':
        this.handleMonsterMove(event);
        break;
      case 'monster-death':
        this.handleMonsterDeath(event, game);
        break;
      case 'tower-build':
        this.handleTowerBuild(event, game);
        break;
      case 'tower-upgrade':
        this.handleTowerUpgrade(event);
        break;
      case 'tower-evolve':
        this.handleTowerEvolve(event);
        break;
      case 'tower-sell':
        this.handleTowerSell(event);
        break;
      case 'tower-attack':
        break;
      case 'skill-use':
        break;
      case 'wave-start':
        this.handleWaveStart(event, game);
        break;
      case 'wave-end':
        this.handleWaveEnd(event, game);
        break;
      case 'game-end':
        this.handleGameEnd(event, game);
        break;
      case 'gold-change':
        this.handleGoldChange(event, game);
        break;
      case 'lives-change':
        this.handleLivesChange(event, game);
        break;
    }
  }

  private handleMonsterSpawn(event: ReplayMonsterSpawnEvent, game: Game): void {
    const config = MONSTER_CONFIG[event.monsterType];
    const monster: Monster = {
      id: event.monsterId,
      type: event.monsterType,
      hp: event.hp,
      maxHp: event.maxHp,
      armor: config.baseArmor,
      magicResist: config.baseMagicResist,
      speed: event.speed,
      baseSpeed: event.speed,
      x: event.x,
      y: event.y,
      pathIndex: 0,
      pathId: event.pathId,
      progress: 0,
      gold: config.gold,
      isFlying: event.isFlying,
      poisonStacks: 0,
      slowTimer: 0,
      eliteAbility: event.eliteAbility,
      bossSkills: event.bossSkills,
      immuneType: 'none',
      isRaging: false,
    };

    if (event.eliteAbility === 'shield') {
      monster.hasShield = true;
      monster.shieldHp = event.hp * 0.3;
    }
    if (event.eliteAbility === 'stealth') {
      monster.isStealthed = true;
      monster.stealthTimer = 5;
    }

    this.monstersMap.set(event.monsterId, monster);
  }

  private handleMonsterMove(event: ReplayMonsterMoveEvent): void {
    const monster = this.monstersMap.get(event.monsterId);
    if (!monster) return;

    monster.x = event.x;
    monster.y = event.y;
    monster.pathIndex = event.pathIndex;
    monster.progress = event.progress;
    monster.hp = event.hp;
    monster.isStealthed = event.isStealthed;
    monster.hasShield = event.hasShield;
    monster.shieldHp = event.shieldHp;
    monster.poisonStacks = event.poisonStacks;
    monster.slowTimer = event.slowTimer;
    monster.slowAmount = event.slowAmount;
    monster.immuneType = event.immuneType;
    monster.isRaging = event.isRaging;
  }

  private handleMonsterDeath(event: ReplayMonsterDeathEvent, game: Game): void {
    this.monstersMap.delete(event.monsterId);
  }

  private handleTowerBuild(event: ReplayTowerBuildEvent, game: Game): void {
    const config = TOWER_CONFIG[event.towerType];
    const tower: Tower = {
      id: event.towerId,
      type: event.towerType,
      level: 1,
      x: event.x,
      y: event.y,
      playerId: event.playerId,
      targetStrategy: 'nearest',
      lastAttackTime: 0,
      cooldown: 0,
      totalCost: event.cost,
      isTrap: config.isTrap,
      trapCooldown: 0,
      damage: config.damage,
      range: config.range,
      attackSpeed: config.attackSpeed,
    };

    this.towersMap.set(event.towerId, tower);
  }

  private handleTowerUpgrade(event: ReplayTowerUpgradeEvent): void {
    const tower = this.towersMap.get(event.towerId);
    if (!tower) return;

    tower.level = event.newLevel;
    tower.damage = event.damage;
    tower.range = event.range;
    tower.attackSpeed = event.attackSpeed;
    tower.totalCost += event.cost;
  }

  private handleTowerEvolve(event: ReplayTowerEvolveEvent): void {
    const tower = this.towersMap.get(event.towerId);
    if (!tower) return;

    tower.branch = event.branch;
    tower.totalCost += event.cost;

    const config = TOWER_CONFIG[tower.type];
    const branchConfig = config.branches[event.branch];
    const modifiers = branchConfig.modifiers;
    if (modifiers.damage) tower.damage *= (1 + modifiers.damage);
    if (modifiers.range) tower.range *= (1 + modifiers.range);
    if (modifiers.attackSpeed) tower.attackSpeed *= (1 + modifiers.attackSpeed);
  }

  private handleTowerSell(event: ReplayTowerSellEvent): void {
    this.towersMap.delete(event.towerId);
  }

  private handleWaveStart(event: ReplayWaveStartEvent, game: Game): void {
    game.currentWave = event.waveNumber;
    game.isWaveActive = true;
    game.waveTimer = 0;
  }

  private handleWaveEnd(event: ReplayWaveEndEvent, game: Game): void {
    game.isWaveActive = false;
    game.waveTimer = 15;
  }

  private handleGameEnd(event: ReplayGameEndEvent, game: Game): void {
    game.state = 'ended';
    game.currentWave = event.finalWave;
  }

  private handleGoldChange(event: ReplayGoldChangeEvent, game: Game): void {
    game.gold = event.newGold;
  }

  private handleLivesChange(event: ReplayLivesChangeEvent, game: Game): void {
    game.lives = event.newLives;
  }

  getTotalDuration(): number {
    return this.replayData.metadata.duration * 1000;
  }

  getMetadata() {
    return this.replayData.metadata;
  }
}
