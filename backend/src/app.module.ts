import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameGateway } from './gateways/game.gateway';
import { RoomService } from './services/room.service';
import { GameEngineService } from './services/game-engine.service';
import { RedisService } from './services/redis.service';
import { ReplayService } from './services/replay.service';
import { AchievementService } from './services/achievement.service';
import { LeaderboardService } from './services/leaderboard.service';
import { SeasonService } from './services/season.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  providers: [
    GameGateway,
    RoomService,
    GameEngineService,
    RedisService,
    ReplayService,
    AchievementService,
    LeaderboardService,
    SeasonService,
  ],
})
export class AppModule {}
