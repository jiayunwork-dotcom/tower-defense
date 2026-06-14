import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { AchievementService } from './achievement.service';
import { LeaderboardType, LeaderboardEntry } from '../types/game.types';
import { LEADERBOARD_KEY_PREFIX } from '../constants/achievements.constants';

@Injectable()
export class LeaderboardService {
  constructor(
    private redisService: RedisService,
    private achievementService: AchievementService
  ) {}

  private getLeaderboardKey(type: LeaderboardType): string {
    return `${LEADERBOARD_KEY_PREFIX}${type}`;
  }

  async addKills(playerId: string, playerName: string, kills: number): Promise<number> {
    const key = this.getLeaderboardKey('kills');
    const newScore = await this.redisService.zincrby(key, kills, playerId);
    await this.achievementService.savePlayerName(playerId, playerName);
    return newScore;
  }

  async updateWaveRecord(playerId: string, playerName: string, wave: number): Promise<number | null> {
    const key = this.getLeaderboardKey('waves');
    const currentScore = await this.redisService.zscore(key, playerId);
    if (currentScore === null || wave > currentScore) {
      await this.redisService.zadd(key, wave, playerId);
      await this.achievementService.savePlayerName(playerId, playerName);
      return wave;
    }
    return currentScore;
  }

  async addWin(playerId: string, playerName: string): Promise<number> {
    const key = this.getLeaderboardKey('wins');
    const newScore = await this.redisService.zincrby(key, 1, playerId);
    await this.achievementService.savePlayerName(playerId, playerName);
    return newScore;
  }

  async getLeaderboard(type: LeaderboardType, limit: number = 20): Promise<LeaderboardEntry[]> {
    const key = this.getLeaderboardKey(type);
    const results = (await this.redisService.zrevrange(key, 0, limit - 1, true)) as {
      member: string;
      score: number;
    }[];

    const entries: LeaderboardEntry[] = [];
    for (let i = 0; i < results.length; i++) {
      const entry = results[i];
      const playerName = (await this.achievementService.getPlayerName(entry.member)) || entry.member;
      entries.push({
        playerId: entry.member,
        playerName,
        value: entry.score,
        rank: i + 1,
      });
    }

    return entries;
  }

  async getPlayerRank(type: LeaderboardType, playerId: string): Promise<number | null> {
    const key = this.getLeaderboardKey(type);
    const rank = await this.redisService.zrank(key, playerId);
    return rank !== null ? rank + 1 : null;
  }

  async getPlayerScore(type: LeaderboardType, playerId: string): Promise<number | null> {
    const key = this.getLeaderboardKey(type);
    return await this.redisService.zscore(key, playerId);
  }
}
