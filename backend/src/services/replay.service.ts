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
  ReplayMarker,
} from '../types/game.types';
import { randomUUID } from 'crypto';

const REPLAY_KEY_PREFIX = 'replay:';
const REPLAY_LIST_KEY = 'replay:list';
const REPLAY_TTL_SECONDS = 24 * 60 * 60;
const MAX_REPLAY_LIST_SIZE = 50;
const MAX_MARKERS_PER_REPLAY = 20;

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
  private memoryReplays: Map<string, ReplayData> = new Map();
  private memoryReplayList: ReplaySummary[] = [];

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
      markers: [],
    };

    this.memoryReplays.set(gameId, replayData);
    this.addToMemoryList(replayData);

    this.saveReplay(replayData).catch((err) => {
      console.error(`[ReplayService] Failed to save replay ${gameId} to Redis:`, err.message);
    });
    this.addReplayToList(replayData).catch((err) => {
      console.error(`[ReplayService] Failed to add replay ${gameId} to list:`, err.message);
    });

    this.activeRecordings.delete(gameId);

    console.log(`[ReplayService] Recording stopped for game ${gameId}, ${recording.events.length} events, duration ${duration.toFixed(1)}s`);
  }

  private async saveReplay(replayData: ReplayData): Promise<void> {
    try {
      const key = `${REPLAY_KEY_PREFIX}${replayData.metadata.gameId}`;
      const value = JSON.stringify(replayData);
      await this.redisService.set(key, value, REPLAY_TTL_SECONDS);
    } catch (err: any) {
      console.warn(`[ReplayService] Redis save failed for replay ${replayData.metadata.gameId}, kept in memory:`, err.message);
      throw err;
    }
  }

  private addToMemoryList(replayData: ReplayData): void {
    const summary: ReplaySummary = {
      gameId: replayData.metadata.gameId,
      startTime: replayData.metadata.startTime,
      duration: replayData.metadata.duration,
      mapName: replayData.metadata.mapName,
      playerCount: replayData.metadata.players.length,
      finalWave: replayData.metadata.finalWave,
      victory: replayData.metadata.victory,
    };

    this.memoryReplayList.unshift(summary);
    this.memoryReplayList = this.memoryReplayList.slice(0, MAX_REPLAY_LIST_SIZE);
  }

  private async addReplayToList(replayData: ReplayData): Promise<void> {
    try {
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
    } catch (err: any) {
      console.warn(`[ReplayService] Redis list update failed, using memory fallback:`, err.message);
      throw err;
    }
  }

  async getReplay(gameId: string): Promise<ReplayData | null> {
    const memoryReplay = this.memoryReplays.get(gameId);
    if (memoryReplay) {
      return memoryReplay;
    }

    try {
      const key = `${REPLAY_KEY_PREFIX}${gameId}`;
      const value = await this.redisService.get(key);
      if (!value) return null;
      try {
        const replayData = JSON.parse(value);
        this.memoryReplays.set(gameId, replayData);
        return replayData;
      } catch {
        return null;
      }
    } catch (err: any) {
      console.warn(`[ReplayService] Redis get failed for replay ${gameId}:`, err.message);
      return null;
    }
  }

  async listReplays(): Promise<ReplaySummary[]> {
    try {
      const listStr = await this.redisService.get(REPLAY_LIST_KEY);
      if (listStr) {
        try {
          const list: ReplaySummary[] = JSON.parse(listStr);
          const result = list.slice(0, 10);
          if (result.length > 0) {
            return result;
          }
        } catch {
          // fall through to memory fallback
        }
      }
    } catch (err: any) {
      console.warn(`[ReplayService] Redis list failed, using memory fallback:`, err.message);
    }

    return this.memoryReplayList.slice(0, 10);
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

  async addMarker(
    gameId: string,
    timestamp: number,
    note: string,
    side?: 'left' | 'right'
  ): Promise<ReplayMarker | null> {
    const replay = await this.getReplay(gameId);
    if (!replay) return null;

    if (replay.markers.length >= MAX_MARKERS_PER_REPLAY) {
      return null;
    }

    const marker: ReplayMarker = {
      id: randomUUID(),
      timestamp,
      note: note.slice(0, 30),
      createdAt: Date.now(),
      side,
    };

    replay.markers.push(marker);
    this.memoryReplays.set(gameId, replay);

    this.saveReplay(replay).catch((err) => {
      console.warn(`[ReplayService] Failed to persist marker for ${gameId}:`, err.message);
    });

    return marker;
  }

  async getMarkers(gameId: string): Promise<ReplayMarker[]> {
    const replay = await this.getReplay(gameId);
    return replay?.markers || [];
  }
}
