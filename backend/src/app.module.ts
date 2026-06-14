import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameGateway } from './gateways/game.gateway';
import { RoomService } from './services/room.service';
import { GameEngineService } from './services/game-engine.service';
import { RedisService } from './services/redis.service';
import { ReplayService } from './services/replay.service';

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
  ],
})
export class AppModule {}
