import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { AchievementService } from './achievement.service';
import { LeaderboardType, LeaderboardEntry, LeaderboardScope } from '../types/game.types';
import {
  SEASON_LEADERBOARD_KEY_PREFIX,
  ALLTIME_LEADERBOARD_KEY_PREFIX,
  PLAYER_BEST_RANK_KEY_PREFIX,
} from '../constants/achievements.constants';

@Injectable()
export class LeaderboardService {
  constructor(
    private redisService: RedisService,
    private achievementService: AchievementService
  ) {}

  private getLeaderboardKey(type: LeaderboardType, scope: LeaderboardScope): string {
    const prefix = scope === 'season' ? SEASON_LEADERBOARD_KEY_PREFIX : ALLTIME_LEADERBOARD_KEY_PREFIX;
    return `${prefix}${type}`;
  }

  private getBestRankKey(playerId: string, type: LeaderboardType, scope: LeaderboardScope): string {
    return `${PLAYER_BEST_RANK_KEY_PREFIX}${scope}:${type}:${playerId}`;
  }

  async addKills(playerId: string, playerName: string, kills: number): Promise<void> {
    const seasonKey = this.getLeaderboardKey('kills', 'season');
    const alltimeKey = this.getLeaderboardKey('kills', 'alltime');
    await this.redisService.zincrby(seasonKey, kills, playerId);
    await this.redisService.zincrby(alltimeKey, kills, playerId);
    await this.achievementService.savePlayerName(playerId, playerName);
  }

  async updateWaveRecord(playerId: string, playerName: string, wave: number): Promise<void> {
    for (const scope of ['season', 'alltime'] as LeaderboardScope[]) {
      const key = this.getLeaderboardKey('waves', scope);
      const currentScore = await this.redisService.zscore(key, playerId);
      if (currentScore === null || wave > currentScore) {
        await this.redisService.zadd(key, wave, playerId);
      }
    }
    await this.achievementService.savePlayerName(playerId, playerName);
  }

  async addWin(playerId: string, playerName: string): Promise<void> {
    const seasonKey = this.getLeaderboardKey('wins', 'season');
    const alltimeKey = this.getLeaderboardKey('wins', 'alltime');
    await this.redisService.zincrby(seasonKey, 1, playerId);
    await this.redisService.zincrby(alltimeKey, 1, playerId);
    await this.achievementService.savePlayerName(playerId, playerName);
  }

  private async updateBestRank(playerId: string, type: LeaderboardType, scope: LeaderboardScope): Promise<void> {
    const currentRank = await this.getPlayerRank(type, playerId, scope);
    if (currentRank === null) return;

    const bestRankKey = this.getBestRankKey(playerId, type, scope);
    const bestRankStr = await this.redisService.get(bestRankKey);
    const bestRank = bestRankStr ? parseInt(bestRankStr, 10) : null;

    if (bestRank === null || currentRank < bestRank) {
      await this.redisService.set(bestRankKey, String(currentRank));
    }
  }

  async getLeaderboard(
    type: LeaderboardType,
    scope: LeaderboardScope,
    currentPlayerId?: string,
    limit: number = 20
  ): Promise<LeaderboardEntry[]> {
    const key = this.getLeaderboardKey(type, scope);
    const results = (await this.redisService.zrevrange(key, 0, limit - 1, true)) as {
      member: string;
      score: number;
    }[];

    const entries: LeaderboardEntry[] = [];
    for (let i = 0; i < results.length; i++) {
      const entry = results[i];
      const playerName = (await this.achievementService.getPlayerName(entry.member)) || entry.member;
      const rank = i + 1;
      let trend: 'up' | 'down' | 'same' | undefined;

      if (currentPlayerId && entry.member === currentPlayerId) {
        trend = await this.getTrend(entry.member, type, scope, rank);
        await this.updateBestRank(entry.member, type, scope);
      }

      entries.push({
        playerId: entry.member,
        playerName,
        score: entry.score,
        rank,
        trend,
      });
    }

    return entries;
  }

  private async getTrend(
    playerId: string,
    type: LeaderboardType,
    scope: LeaderboardScope,
    currentRank: number
  ): Promise<'up' | 'down' | 'same' | undefined> {
    const bestRankKey = this.getBestRankKey(playerId, type, scope);
    const bestRankStr = await this.redisService.get(bestRankKey);
    if (!bestRankStr) return undefined;

    const bestRank = parseInt(bestRankStr, 10);
    if (currentRank < bestRank) return 'up';
    if (currentRank > bestRank) return 'down';
    return 'same';
  }

  async getPlayerRank(
    type: LeaderboardType,
    playerId: string,
    scope: LeaderboardScope
  ): Promise<number | null> {
    const key = this.getLeaderboardKey(type, scope);
    const rank = await this.redisService.zrank(key, playerId);
    return rank !== null ? rank + 1 : null;
  }

  async getPlayerScore(
    type: LeaderboardType,
    playerId: string,
    scope: LeaderboardScope
  ): Promise<number | null> {
    const key = this.getLeaderboardKey(type, scope);
    return await this.redisService.zscore(key, playerId);
  }
}
