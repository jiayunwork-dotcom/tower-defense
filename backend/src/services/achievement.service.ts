import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import {
  AchievementDef,
  PlayerAchievementProgress,
  PlayerGameSessionStats,
} from '../types/game.types';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_MAP,
  ACHIEVEMENT_REDIS_KEY_PREFIX,
  PLAYER_NAME_KEY_PREFIX,
} from '../constants/achievements.constants';

@Injectable()
export class AchievementService {
  constructor(private redisService: RedisService) {}

  private getAchievementKey(playerId: string): string {
    return `${ACHIEVEMENT_REDIS_KEY_PREFIX}${playerId}`;
  }

  private getPlayerNameKey(playerId: string): string {
    return `${PLAYER_NAME_KEY_PREFIX}${playerId}`;
  }

  async savePlayerName(playerId: string, playerName: string): Promise<void> {
    await this.redisService.set(this.getPlayerNameKey(playerId), playerName);
  }

  async getPlayerName(playerId: string): Promise<string | null> {
    return await this.redisService.get(this.getPlayerNameKey(playerId));
  }

  async getAllPlayerAchievements(playerId: string): Promise<PlayerAchievementProgress[]> {
    const key = this.getAchievementKey(playerId);
    const data = await this.redisService.hgetall(key);

    return ACHIEVEMENTS.map((def) => {
      const valueStr = data[def.id];
      if (valueStr) {
        try {
          const parsed = JSON.parse(valueStr);
          return {
            id: def.id,
            currentValue: parsed.currentValue || 0,
            unlocked: parsed.unlocked || false,
            unlockedAt: parsed.unlockedAt,
          };
        } catch {
          return {
            id: def.id,
            currentValue: 0,
            unlocked: false,
          };
        }
      }
      return {
        id: def.id,
        currentValue: 0,
        unlocked: false,
      };
    });
  }

  async getPlayerAchievement(playerId: string, achievementId: string): Promise<PlayerAchievementProgress | null> {
    const def = ACHIEVEMENT_MAP.get(achievementId);
    if (!def) return null;

    const key = this.getAchievementKey(playerId);
    const valueStr = await this.redisService.hget(key, achievementId);

    if (valueStr) {
      try {
        const parsed = JSON.parse(valueStr);
        return {
          id: achievementId,
          currentValue: parsed.currentValue || 0,
          unlocked: parsed.unlocked || false,
          unlockedAt: parsed.unlockedAt,
        };
      } catch {
        // fall through
      }
    }
    return {
      id: achievementId,
      currentValue: 0,
      unlocked: false,
    };
  }

  async checkAndUnlockAchievements(
    playerId: string,
    sessionStats: PlayerGameSessionStats
  ): Promise<AchievementDef[]> {
    const newlyUnlocked: AchievementDef[] = [];
    const key = this.getAchievementKey(playerId);
    const allProgress = await this.getAllPlayerAchievements(playerId);
    const progressMap = new Map(allProgress.map((p) => [p.id, p]));

    const cumulativeValues = this.getCumulativeValues(progressMap, sessionStats);

    for (const def of ACHIEVEMENTS) {
      const progress = progressMap.get(def.id);
      if (!progress || progress.unlocked) continue;

      const currentValue = cumulativeValues.get(def.id) || 0;
      if (currentValue >= def.threshold) {
        progress.unlocked = true;
        progress.unlockedAt = Date.now();
        progress.currentValue = currentValue;
        newlyUnlocked.push(def);

        await this.redisService.hset(
          key,
          def.id,
          JSON.stringify({
            currentValue: progress.currentValue,
            unlocked: true,
            unlockedAt: progress.unlockedAt,
          })
        );
      }
    }

    return newlyUnlocked;
  }

  private getCumulativeValues(
    progressMap: Map<string, PlayerAchievementProgress>,
    sessionStats: PlayerGameSessionStats
  ): Map<string, number> {
    const values = new Map<string, number>();

    for (const def of ACHIEVEMENTS) {
      const progress = progressMap.get(def.id);
      const historicalValue = progress?.currentValue || 0;

      let sessionValue = 0;
      switch (def.category) {
        case 'kill':
          sessionValue = sessionStats.kills;
          break;
        case 'build':
          sessionValue = sessionStats.towersBuilt;
          break;
        case 'economy':
          sessionValue = sessionStats.goldSpent;
          break;
        case 'clear':
          if (sessionStats.victory) {
            if (
              (def.id === 'clear_normal' && sessionStats.difficulty === 'normal') ||
              (def.id === 'clear_hard' && sessionStats.difficulty === 'hard') ||
              (def.id === 'clear_hell' && sessionStats.difficulty === 'hell')
            ) {
              sessionValue = 1;
            }
          }
          break;
      }

      if (def.isPerSession) {
        values.set(def.id, Math.max(historicalValue, sessionValue));
      } else {
        values.set(def.id, historicalValue + sessionValue);
      }
    }

    return values;
  }

  async mergeSessionStats(
    playerId: string,
    sessionStats: PlayerGameSessionStats
  ): Promise<void> {
    const key = this.getAchievementKey(playerId);
    const allProgress = await this.getAllPlayerAchievements(playerId);

    for (const progress of allProgress) {
      const def = ACHIEVEMENT_MAP.get(progress.id);
      if (!def) continue;

      let sessionValue = 0;
      switch (def.category) {
        case 'kill':
          sessionValue = sessionStats.kills;
          break;
        case 'build':
          sessionValue = sessionStats.towersBuilt;
          break;
        case 'economy':
          sessionValue = sessionStats.goldSpent;
          break;
        case 'clear':
          if (sessionStats.victory) {
            if (
              (def.id === 'clear_normal' && sessionStats.difficulty === 'normal') ||
              (def.id === 'clear_hard' && sessionStats.difficulty === 'hard') ||
              (def.id === 'clear_hell' && sessionStats.difficulty === 'hell')
            ) {
              sessionValue = 1;
            }
          }
          break;
      }

      if (!progress.unlocked && sessionValue > 0) {
        let newValue: number;
        if (def.isPerSession) {
          newValue = Math.max(progress.currentValue, sessionValue);
        } else {
          newValue = progress.currentValue + sessionValue;
        }

        if (newValue !== progress.currentValue) {
          await this.redisService.hset(
            key,
            progress.id,
            JSON.stringify({
              currentValue: newValue,
              unlocked: false,
            })
          );
        }
      }
    }
  }

  getAchievementDefs(): AchievementDef[] {
    return ACHIEVEMENTS;
  }

  getAchievementDef(id: string): AchievementDef | undefined {
    return ACHIEVEMENT_MAP.get(id);
  }

  async unlockAchievement(playerId: string, achievementId: string): Promise<boolean> {
    const def = ACHIEVEMENT_MAP.get(achievementId);
    if (!def) return false;

    const key = this.getAchievementKey(playerId);
    const valueStr = await this.redisService.hget(key, achievementId);
    
    let currentValue = 0;
    let unlocked = false;
    
    if (valueStr) {
      try {
        const parsed = JSON.parse(valueStr);
        currentValue = parsed.currentValue || 0;
        unlocked = parsed.unlocked || false;
      } catch {
        // ignore parse errors
      }
    }

    if (unlocked) return false;

    await this.redisService.hset(
      key,
      achievementId,
      JSON.stringify({
        currentValue: Math.max(currentValue, def.threshold),
        unlocked: true,
        unlockedAt: Date.now(),
      })
    );

    return true;
  }
}
