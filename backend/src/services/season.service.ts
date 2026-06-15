import { Injectable, OnModuleInit } from '@nestjs/common';
import { RedisService } from './redis.service';
import { SeasonInfo } from '../types/game.types';
import {
  SEASON_INFO_KEY,
  SEASON_DURATION_SECONDS,
  ACHIEVEMENT_REDIS_KEY_PREFIX,
  ACHIEVEMENTS,
  PLAYER_BEST_RANK_KEY_PREFIX,
} from '../constants/achievements.constants';

@Injectable()
export class SeasonService implements OnModuleInit {
  constructor(private redisService: RedisService) {}

  private checkInterval: NodeJS.Timeout | null = null;

  onModuleInit() {
    this.ensureSeasonExists();
    this.startSeasonCheck();
  }

  private async ensureSeasonExists(): Promise<void> {
    const exists = await this.redisService.exists(SEASON_INFO_KEY);
    if (!exists) {
      const now = Date.now();
      const seasonInfo = {
        seasonNumber: 1,
        startTime: now,
        endTime: now + SEASON_DURATION_SECONDS * 1000,
      };
      await this.redisService.set(SEASON_INFO_KEY, JSON.stringify(seasonInfo));
      console.log('[Season] Created initial season #1');
    }
  }

  private startSeasonCheck(): void {
    this.checkInterval = setInterval(async () => {
      await this.checkAndRotateSeason();
    }, 60 * 1000);
  }

  async checkAndRotateSeason(): Promise<boolean> {
    const info = await this.getCurrentSeasonInfo();
    const now = Date.now();

    if (now >= info.endTime) {
      await this.rotateSeason(info.seasonNumber + 1);
      return true;
    }
    return false;
  }

  private async rotateSeason(newSeasonNumber: number): Promise<void> {
    const now = Date.now();
    const newSeasonInfo = {
      seasonNumber: newSeasonNumber,
      startTime: now,
      endTime: now + SEASON_DURATION_SECONDS * 1000,
    };
    await this.redisService.set(SEASON_INFO_KEY, JSON.stringify(newSeasonInfo));

    await this.resetPerSessionAchievements();
    await this.resetSeasonLeaderboards();

    console.log(`[Season] Rotated to season #${newSeasonNumber}`);
  }

  private async resetPerSessionAchievements(): Promise<void> {
    const keys = await this.scanKeys(`${ACHIEVEMENT_REDIS_KEY_PREFIX}*`);
    const perSessionIds = ACHIEVEMENTS.filter(a => a.isPerSession).map(a => a.id);

    for (const key of keys) {
      for (const achievementId of perSessionIds) {
        const valueStr = await this.redisService.hget(key, achievementId);
        if (valueStr) {
          try {
            const parsed = JSON.parse(valueStr);
            if (!parsed.unlocked) {
              await this.redisService.hset(
                key,
                achievementId,
                JSON.stringify({ currentValue: 0, unlocked: false })
              );
            } else {
              await this.redisService.hset(
                key,
                achievementId,
                JSON.stringify({
                  currentValue: parsed.currentValue || 0,
                  unlocked: true,
                  unlockedAt: parsed.unlockedAt,
                })
              );
            }
          } catch {
            await this.redisService.hset(
              key,
              achievementId,
              JSON.stringify({ currentValue: 0, unlocked: false })
            );
          }
        }
      }
    }
  }

  private async resetSeasonLeaderboards(): Promise<void> {
    const seasonKeys = await this.scanKeys('td:leaderboard:season:*');
    for (const key of seasonKeys) {
      await this.redisService.del(key);
    }
    const seasonBestRankKeys = await this.scanKeys(`${PLAYER_BEST_RANK_KEY_PREFIX}season:*`);
    for (const key of seasonBestRankKeys) {
      await this.redisService.del(key);
    }
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const client = this.redisService.getClient();
    if (!client) {
      return [];
    }

    const keys: string[] = [];
    let cursor = '0';
    do {
      const result = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');
    return keys;
  }

  async getCurrentSeasonInfo(): Promise<SeasonInfo> {
    await this.checkAndRotateSeason();

    const data = await this.redisService.get(SEASON_INFO_KEY);
    if (!data) {
      const now = Date.now();
      return {
        seasonNumber: 1,
        startTime: now,
        endTime: now + SEASON_DURATION_SECONDS * 1000,
        nowTime: now,
        remainingSeconds: SEASON_DURATION_SECONDS,
      };
    }

    try {
      const parsed = JSON.parse(data);
      const now = Date.now();
      const remainingSeconds = Math.max(0, Math.floor((parsed.endTime - now) / 1000));
      return {
        seasonNumber: parsed.seasonNumber,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        nowTime: now,
        remainingSeconds,
      };
    } catch {
      const now = Date.now();
      return {
        seasonNumber: 1,
        startTime: now,
        endTime: now + SEASON_DURATION_SECONDS * 1000,
        nowTime: now,
        remainingSeconds: SEASON_DURATION_SECONDS,
      };
    }
  }

  async getCurrentSeasonNumber(): Promise<number> {
    const info = await this.getCurrentSeasonInfo();
    return info.seasonNumber;
  }
}
