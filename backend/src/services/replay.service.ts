import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import {
  ReplayEvent,
  ReplayData,
  ReplayMetadata,
  ReplaySummary,
  Game,
  ReplayPlayerInfo,
  ReplayMonsterSpawnEvent,
  ReplayMonsterMoveEvent,
  ReplayMonsterDeathEvent,
  ReplayTowerBuildEvent,
  ReplayTowerUpgradeEvent,
  ReplayTowerEvolveEvent,
  ReplayTowerSellEvent,
  ReplayTowerAttackEvent,
  ReplaySkillUseEvent,
  ReplayWaveStartEvent,
  ReplayWaveEndEvent,
  ReplayGameEndEvent,
  ReplayGoldChangeEvent,
  ReplayLivesChangeEvent,
  Monster,
  Tower,
  Player,
  TowerType,
  TowerBranch,
  SkillType,
  TargetStrategy,
  MonsterType,
  EliteAbility,
  BossSkill,
  ImmuneType,
} from '../types/game.types';

const REPLAY_KEY_PREFIX = 'replay:';
const REPLAY_LIST_KEY = 'replay:list';
const REPLAY_TTL_SECONDS = 24 * 60 * 60;
const MAX_REPLAY_LIST_SIZE = 50;

interface ActiveRecording {
  gameId: string;
  startTime: number;
  mapName: string;
  players: ReplayPlayerInfo[];
  events: ReplayEvent[];
  lastGold: number;
  lastLives: number;
}

@Injectable()
export class ReplayService {
  private activeRecordings: Map<string, ActiveRecording> = new Map();

  constructor(private redisService: RedisService) {}

  startRecording(game: Game, mapName: string): void {
    const players: ReplayPlayerInfo[] = game.players.map((p: Player) => ({
      name: p.name,
      color: p.color,
    }));

    const recording: ActiveRecording = {
      gameId: game.id,
      startTime: Date.now(),
      mapName,
      players,
      events: [],
      lastGold: game.gold,
      lastLives: game.lives,
    };

    this.activeRecordings.set(game.id, recording);
  }

  stopRecording(gameId: string, finalWave: number, victory: boolean): void {
    const recording = this.activeRecordings.get(gameId);
    if (!recording) return;

    const endTime = Date.now();
    const duration = (endTime - recording.startTime) / 1000;

    const metadata: ReplayMetadata = {
      gameId,
      startTime: recording.startTime,
      endTime,
      duration,
      mapName: recording.mapName,
      players: recording.players,
      finalWave,
      victory,
      totalEvents: recording.events.length,
    };

    const replayData: ReplayData = {
      metadata,
      events: recording.events,
    };

    this.saveReplay(replayData);
    this.addReplayToList(replayData);

    this.activeRecordings.delete(gameId);
  }

  private async saveReplay(replayData: ReplayData): Promise<void> {
    const key = `${REPLAY_KEY_PREFIX}${replayData.metadata.gameId}`;
    const value = JSON.stringify(replayData);
    await this.redisService.set(key, value, REPLAY_TTL_SECONDS);
  }

  private async addReplayToList(replayData: ReplayData): Promise<void> {
    const summary: ReplaySummary = {
      gameId: replayData.metadata.gameId,
      startTime: replayData.metadata.startTime,
      duration: replayData.metadata.duration,
      mapName: replayData.metadata.mapName,
      playerCount: replayData.metadata.players.length,
      finalWave: replayData.metadata.finalWave,
      victory: replayData.metadata.victory,
    };

    const listStr = await this.redisService.get(REPLAY_LIST_KEY);
    let list: ReplaySummary[] = [];
    if (listStr) {
      try {
        list = JSON.parse(listStr);
      } catch {
        list = [];
      }
    }

    list.unshift(summary);
    list = list.slice(0, MAX_REPLAY_LIST_SIZE);

    await this.redisService.set(REPLAY_LIST_KEY, JSON.stringify(list));
  }

  async getReplay(gameId: string): Promise<ReplayData | null> {
    const key = `${REPLAY_KEY_PREFIX}${gameId}`;
    const value = await this.redisService.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  async listReplays(): Promise<ReplaySummary[]> {
    const listStr = await this.redisService.get(REPLAY_LIST_KEY);
    if (!listStr) return [];
    try {
      const list: ReplaySummary[] = JSON.parse(listStr);
      return list.slice(0, 10);
    } catch {
      return [];
    }
  }

  recordMonsterSpawn(
    gameId: string,
    monster: Monster,
    elapsedTime: number
  ): void {
    const recording = this.activeRecordings.get(gameId);
    if (!recording) return;

    const timestamp = elapsedTime * 1000;

    const event: ReplayMonsterSpawnEvent = {
      type: 'monster-spawn',
      timestamp,
      monsterId: monster.id,
      monsterType: monster.type,
      pathId: monster.pathId,
      x: monster.x,
      y: monster.y,
      hp: monster.hp,
      maxHp: monster.maxHp,
      speed: monster.speed,
      eliteAbility: monster.eliteAbility,
      bossSkills: monster.bossSkills,
      isFlying: monster.isFlying,
    };

    recording.events.push(event);
  }

  recordMonsterMove(
    gameId: string,
    monster: Monster,
    elapsedTime: number
  ): void {
    const recording = this.activeRecordings.get(gameId);
    if (!recording) return;

    const timestamp = elapsedTime * 1000;

    const event: ReplayMonsterMoveEvent = {
      type: 'monster-move',
      timestamp,
      monsterId: monster.id,
      x: monster.x,
      y: monster.y,
      pathIndex: monster.pathIndex,
      progress: monster.progress,
      hp: monster.hp,
      isStealthed: monster.isStealthed,
      hasShield: monster.hasShield,
      shieldHp: monster.shieldHp,
      poisonStacks: monster.poisonStacks,
      slowTimer: monster.slowTimer,
      slowAmount: monster.slowAmount,
      immuneType: monster.immuneType,
      isRaging: monster.isRaging,
    };

    recording.events.push(event);
  }

  recordMonsterDeath(
    gameId: string,
    monsterId: string,
    goldReward: number,
    elapsedTime: number
  ): void {
    const recording = this.activeRecordings.get(gameId);
    if (!recording) return;

    const timestamp = elapsedTime * 1000;

    const event: ReplayMonsterDeathEvent = {
      type: 'monster-death',
      timestamp,
      monsterId,
      goldReward,
    };

    recording.events.push(event);
  }

  recordTowerBuild(
    gameId: string,
    tower: Tower,
    cost: number,
    elapsedTime: number
  ): void {
    const recording = this.activeRecordings.get(gameId);
    if (!recording) return;

    const timestamp = elapsedTime * 1000;

    const event: ReplayTowerBuildEvent = {
      type: 'tower-build',
      timestamp,
      towerId: tower.id,
      towerType: tower.type,
      x: tower.x,
      y: tower.y,
      playerId: tower.playerId,
      cost,
    };

    recording.events.push(event);
  }

  recordTowerUpgrade(
    gameId: string,
    tower: Tower,
    cost: number,
    elapsedTime: number
  ): void {
    const recording = this.activeRecordings.get(gameId);
    if (!recording) return;

    const timestamp = elapsedTime * 1000;

    const event: ReplayTowerUpgradeEvent = {
      type: 'tower-upgrade',
      timestamp,
      towerId: tower.id,
      newLevel: tower.level,
      cost,
      damage: tower.damage,
      range: tower.range,
      attackSpeed: tower.attackSpeed,
    };

    recording.events.push(event);
  }

  recordTowerEvolve(
    gameId: string,
    towerId: string,
    branch: TowerBranch,
    cost: number,
    elapsedTime: number
  ): void {
    const recording = this.activeRecordings.get(gameId);
    if (!recording) return;

    const timestamp = elapsedTime * 1000;

    const event: ReplayTowerEvolveEvent = {
      type: 'tower-evolve',
      timestamp,
      towerId,
      branch,
      cost,
    };

    recording.events.push(event);
  }

  recordTowerSell(
    gameId: string,
    towerId: string,
    refund: number,
    elapsedTime: number
  ): void {
    const recording = this.activeRecordings.get(gameId);
    if (!recording) return;

    const timestamp = elapsedTime * 1000;

    const event: ReplayTowerSellEvent = {
      type: 'tower-sell',
      timestamp,
      towerId,
      refund,
    };

    recording.events.push(event);
  }

  recordTowerAttack(
    gameId: string,
    towerId: string,
    targetId: string,
    damage: number,
    isAOE: boolean = false,
    isDOT: boolean = false,
    isSlow: boolean = false,
    elapsedTime: number
  ): void {
    const recording = this.activeRecordings.get(gameId);
    if (!recording) return;

    const timestamp = elapsedTime * 1000;

    const event: ReplayTowerAttackEvent = {
      type: 'tower-attack',
      timestamp,
      towerId,
      targetId,
      damage,
      isAOE,
      isDOT,
      isSlow,
    };

    recording.events.push(event);
  }

  recordSkillUse(
    gameId: string,
    playerId: string,
    skillType: SkillType,
    targetX: number | undefined,
    targetY: number | undefined,
    elapsedTime: number
  ): void {
    const recording = this.activeRecordings.get(gameId);
    if (!recording) return;

    const timestamp = elapsedTime * 1000;

    const event: ReplaySkillUseEvent = {
      type: 'skill-use',
      timestamp,
      playerId,
      skillType,
      targetX,
      targetY,
    };

    recording.events.push(event);
  }

  recordWaveStart(
    gameId: string,
    waveNumber: number,
    isBossWave: boolean,
    elapsedTime: number
  ): void {
    const recording = this.activeRecordings.get(gameId);
    if (!recording) return;

    const timestamp = elapsedTime * 1000;

    const event: ReplayWaveStartEvent = {
      type: 'wave-start',
      timestamp,
      waveNumber,
      isBossWave,
    };

    recording.events.push(event);
  }

  recordWaveEnd(
    gameId: string,
    waveNumber: number,
    interestGold: number,
    elapsedTime: number
  ): void {
    const recording = this.activeRecordings.get(gameId);
    if (!recording) return;

    const timestamp = elapsedTime * 1000;

    const event: ReplayWaveEndEvent = {
      type: 'wave-end',
      timestamp,
      waveNumber,
      interestGold,
    };

    recording.events.push(event);
  }

  recordGameEnd(
    gameId: string,
    victory: boolean,
    finalWave: number,
    elapsedTime: number
  ): void {
    const recording = this.activeRecordings.get(gameId);
    if (!recording) return;

    const timestamp = elapsedTime * 1000;

    const event: ReplayGameEndEvent = {
      type: 'game-end',
      timestamp,
      victory,
      finalWave,
    };

    recording.events.push(event);
  }

  recordGoldChange(
    gameId: string,
    newGold: number,
    elapsedTime: number
  ): void {
    const recording = this.activeRecordings.get(gameId);
    if (!recording) return;

    if (recording.lastGold === newGold) return;
    recording.lastGold = newGold;

    const timestamp = elapsedTime * 1000;

    const event: ReplayGoldChangeEvent = {
      type: 'gold-change',
      timestamp,
      newGold,
    };

    recording.events.push(event);
  }

  recordLivesChange(
    gameId: string,
    newLives: number,
    lostLives: number,
    elapsedTime: number
  ): void {
    const recording = this.activeRecordings.get(gameId);
    if (!recording) return;

    if (recording.lastLives === newLives) return;
    recording.lastLives = newLives;

    const timestamp = elapsedTime * 1000;

    const event: ReplayLivesChangeEvent = {
      type: 'lives-change',
      timestamp,
      newLives,
      lostLives,
    };

    recording.events.push(event);
  }

  isRecording(gameId: string): boolean {
    return this.activeRecordings.has(gameId);
  }
}
