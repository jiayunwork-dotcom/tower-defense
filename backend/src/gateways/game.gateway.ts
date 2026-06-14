import { 
  WebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage, 
  OnGatewayConnection, 
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomService } from '../services/room.service';
import { GameEngineService } from '../services/game-engine.service';
import { TowerType, TargetStrategy, SkillType } from '../types/game.types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/game'
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private gameTickIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private roomService: RoomService,
    private gameEngineService: GameEngineService
  ) {}

  handleConnection(client: Socket) {
    console.log('Client connected:', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
    
    const room = this.roomService.findRoomByPlayer(client.id);
    if (room) {
      if (room.game && room.game.state === 'playing') {
        this.gameEngineService.handleDisconnect(room.game, client.id);
      }
      
      this.server.to(room.id).emit('player-left', {
        playerId: client.id,
        players: room.players
      });
    }
  }

  @SubscribeMessage('create-room')
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { name: string; maxPlayers?: number }
  ) {
    const room = this.roomService.createRoom(
      data.name,
      client.id,
      `Player_${client.id.slice(0, 4)}`,
      data.maxPlayers || 4
    );
    
    client.join(room.id);
    client.data.roomId = room.id;
    
    return { success: true, room };
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerName?: string }
  ) {
    const room = this.roomService.joinRoom(
      data.roomId,
      client.id,
      data.playerName || `Player_${client.id.slice(0, 4)}`
    );
    
    if (!room) {
      return { success: false, error: 'Room not found or full' };
    }

    client.join(room.id);
    client.data.roomId = room.id;

    this.server.to(room.id).emit('player-joined', {
      playerId: client.id,
      players: room.players
    });

    return { success: true, room };
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(@ConnectedSocket() client: Socket) {
    const roomId = client.data.roomId;
    if (!roomId) return { success: false, error: 'Not in a room' };

    this.roomService.leaveRoom(roomId, client.id);
    client.leave(roomId);
    client.data.roomId = null;

    this.server.to(roomId).emit('player-left', {
      playerId: client.id,
      players: this.roomService.getRoom(roomId)?.players || []
    });

    return { success: true };
  }

  @SubscribeMessage('list-rooms')
  handleListRooms() {
    const rooms = this.roomService.listRooms();
    return { success: true, rooms };
  }

  @SubscribeMessage('set-ready')
  handleSetReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { isReady: boolean }
  ) {
    const roomId = client.data.roomId;
    if (!roomId) return { success: false, error: 'Not in a room' };

    const room = this.roomService.setPlayerReady(roomId, client.id, data.isReady);
    if (!room) return { success: false, error: 'Room not found' };

    this.server.to(roomId).emit('player-ready-changed', {
      playerId: client.id,
      isReady: data.isReady,
      players: room.players
    });

    return { success: true, room };
  }

  @SubscribeMessage('select-map')
  handleSelectMap(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { mapName: string }
  ) {
    const roomId = client.data.roomId;
    if (!roomId) return { success: false, error: 'Not in a room' };

    const room = this.roomService.setSelectedMap(roomId, client.id, data.mapName);
    if (!room) return { success: false, error: 'Room not found or not host' };

    this.server.to(roomId).emit('map-changed', {
      mapName: data.mapName,
      room
    });

    return { success: true, room };
  }

  @SubscribeMessage('select-skill')
  handleSelectSkill(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { skill: SkillType }
  ) {
    const roomId = client.data.roomId;
    if (!roomId) return { success: false, error: 'Not in a room' };

    const room = this.roomService.setPlayerSkill(roomId, client.id, data.skill);
    if (!room) return { success: false, error: 'Skill already taken or room not found' };

    this.server.to(roomId).emit('player-skill-changed', {
      playerId: client.id,
      skill: data.skill,
      players: room.players
    });

    return { success: true, room };
  }

  @SubscribeMessage('start-game')
  handleStartGame(@ConnectedSocket() client: Socket) {
    const roomId = client.data.roomId;
    if (!roomId) return { success: false, error: 'Not in a room' };

    const room = this.roomService.startGame(roomId);
    if (!room) return { success: false, error: 'Cannot start game' };

    this.server.to(roomId).emit('game-started', {
      game: room.game,
      room
    });

    this.startGameTick(roomId);

    return { success: true, game: room.game };
  }

  private startGameTick(roomId: string): void {
    if (this.gameTickIntervals.has(roomId)) return;

    const interval = setInterval(() => {
      const game = this.gameEngineService.getGame(roomId);
      if (!game || game.state !== 'playing') {
        this.stopGameTick(roomId);
        return;
      }

      this.server.to(roomId).emit('game-state', {
        game: this.serializeGame(game)
      });
    }, 1000 / 30);

    this.gameTickIntervals.set(roomId, interval);
  }

  private stopGameTick(roomId: string): void {
    const interval = this.gameTickIntervals.get(roomId);
    if (interval) {
      clearInterval(interval);
      this.gameTickIntervals.delete(roomId);
    }
  }

  private serializeGame(game: any): any {
    return {
      id: game.id,
      state: game.state,
      map: game.map,
      players: game.players,
      towers: game.towers,
      monsters: game.monsters.map((m: any) => ({
        id: m.id,
        type: m.type,
        hp: m.hp,
        maxHp: m.maxHp,
        x: m.x,
        y: m.y,
        isFlying: m.isFlying,
        isStealthed: m.isStealthed,
        hasShield: m.hasShield,
        shieldHp: m.shieldHp,
        poisonStacks: m.poisonStacks,
        slowTimer: m.slowTimer,
        immuneType: m.immuneType,
        isRaging: m.isRaging
      })),
      gold: game.gold,
      lives: game.lives,
      maxLives: game.maxLives,
      currentWave: game.currentWave,
      totalWaves: game.totalWaves,
      waveTimer: game.waveTimer,
      isWaveActive: game.isWaveActive,
      gameSpeed: game.gameSpeed,
      pings: game.pings,
      elapsedTime: game.elapsedTime,
      isEndless: game.isEndless,
      skipWaveVote: game.skipWaveVote
    };
  }

  @SubscribeMessage('build-tower')
  handleBuildTower(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { type: TowerType; x: number; y: number }
  ) {
    const roomId = client.data.roomId;
    if (!roomId) return { success: false, error: 'Not in a room' };

    const game = this.gameEngineService.getGame(roomId);
    if (!game || game.state !== 'playing') {
      return { success: false, error: 'Game not active' };
    }

    const tower = this.gameEngineService.buildTower(game, client.id, data.type, data.x, data.y);
    if (!tower) return { success: false, error: 'Cannot build tower here' };

    this.server.to(roomId).emit('tower-built', {
      tower,
      gold: game.gold,
      playerId: client.id
    });

    return { success: true, tower };
  }

  @SubscribeMessage('upgrade-tower')
  handleUpgradeTower(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { towerId: string }
  ) {
    const roomId = client.data.roomId;
    if (!roomId) return { success: false, error: 'Not in a room' };

    const game = this.gameEngineService.getGame(roomId);
    if (!game || game.state !== 'playing') {
      return { success: false, error: 'Game not active' };
    }

    const tower = this.gameEngineService.upgradeTower(game, data.towerId);
    if (!tower) return { success: false, error: 'Cannot upgrade tower' };

    this.server.to(roomId).emit('tower-upgraded', {
      tower,
      gold: game.gold
    });

    return { success: true, tower };
  }

  @SubscribeMessage('evolve-tower')
  handleEvolveTower(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { towerId: string; branch: 'a' | 'b' }
  ) {
    const roomId = client.data.roomId;
    if (!roomId) return { success: false, error: 'Not in a room' };

    const game = this.gameEngineService.getGame(roomId);
    if (!game || game.state !== 'playing') {
      return { success: false, error: 'Game not active' };
    }

    const tower = this.gameEngineService.evolveTower(game, data.towerId, data.branch);
    if (!tower) return { success: false, error: 'Cannot evolve tower' };

    this.server.to(roomId).emit('tower-evolved', {
      tower,
      gold: game.gold
    });

    return { success: true, tower };
  }

  @SubscribeMessage('sell-tower')
  handleSellTower(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { towerId: string }
  ) {
    const roomId = client.data.roomId;
    if (!roomId) return { success: false, error: 'Not in a room' };

    const game = this.gameEngineService.getGame(roomId);
    if (!game || game.state !== 'playing') {
      return { success: false, error: 'Game not active' };
    }

    const success = this.gameEngineService.sellTower(game, data.towerId);
    if (!success) return { success: false, error: 'Cannot sell tower' };

    this.server.to(roomId).emit('tower-sold', {
      towerId: data.towerId,
      gold: game.gold
    });

    return { success: true };
  }

  @SubscribeMessage('set-tower-strategy')
  handleSetTowerStrategy(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { towerId: string; strategy: TargetStrategy }
  ) {
    const roomId = client.data.roomId;
    if (!roomId) return { success: false, error: 'Not in a room' };

    const game = this.gameEngineService.getGame(roomId);
    if (!game || game.state !== 'playing') {
      return { success: false, error: 'Game not active' };
    }

    const success = this.gameEngineService.setTowerStrategy(game, data.towerId, data.strategy);
    if (!success) return { success: false, error: 'Cannot set strategy' };

    this.server.to(roomId).emit('tower-strategy-changed', {
      towerId: data.towerId,
      strategy: data.strategy
    });

    return { success: true };
  }

  @SubscribeMessage('use-skill')
  handleUseSkill(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { skill: SkillType; targetX?: number; targetY?: number }
  ) {
    const roomId = client.data.roomId;
    if (!roomId) return { success: false, error: 'Not in a room' };

    const game = this.gameEngineService.getGame(roomId);
    if (!game || game.state !== 'playing') {
      return { success: false, error: 'Game not active' };
    }

    const success = this.gameEngineService.useSkill(game, client.id, data.skill, data.targetX, data.targetY);
    if (!success) return { success: false, error: 'Cannot use skill' };

    this.server.to(roomId).emit('skill-used', {
      playerId: client.id,
      skill: data.skill,
      targetX: data.targetX,
      targetY: data.targetY,
      cooldown: 60
    });

    return { success: true };
  }

  @SubscribeMessage('send-ping')
  handleSendPing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { x: number; y: number }
  ) {
    const roomId = client.data.roomId;
    if (!roomId) return { success: false, error: 'Not in a room' };

    const game = this.gameEngineService.getGame(roomId);
    if (!game) return { success: false, error: 'Game not found' };

    this.gameEngineService.addPing(game, client.id, data.x, data.y);

    this.server.to(roomId).emit('ping-received', {
      x: data.x,
      y: data.y,
      playerId: client.id
    });

    return { success: true };
  }

  @SubscribeMessage('skip-wave')
  handleSkipWave(@ConnectedSocket() client: Socket) {
    const roomId = client.data.roomId;
    if (!roomId) return { success: false, error: 'Not in a room' };

    const game = this.gameEngineService.getGame(roomId);
    if (!game || game.state !== 'playing') {
      return { success: false, error: 'Game not active' };
    }

    const success = this.gameEngineService.voteSkipWave(game, client.id);
    if (!success) return { success: false, error: 'Cannot skip wave' };

    this.server.to(roomId).emit('skip-wave-vote', {
      playerId: client.id,
      votes: game.skipWaveVote
    });

    return { success: true };
  }

  @SubscribeMessage('vote-speed')
  handleVoteSpeed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { speed: number }
  ) {
    const roomId = client.data.roomId;
    if (!roomId) return { success: false, error: 'Not in a room' };

    const game = this.gameEngineService.getGame(roomId);
    if (!game || game.state !== 'playing') {
      return { success: false, error: 'Game not active' };
    }

    const changed = this.gameEngineService.voteGameSpeed(game, client.id, data.speed);

    this.server.to(roomId).emit('speed-vote', {
      playerId: client.id,
      speed: data.speed,
      currentSpeed: game.gameSpeed,
      speedVotes: game.speedVote
    });

    return { success: true, changed };
  }

  @SubscribeMessage('chat-message')
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message: string }
  ) {
    const roomId = client.data.roomId;
    if (!roomId) return { success: false, error: 'Not in a room' };

    const player = this.roomService.getRoom(roomId)?.players.find(p => p.id === client.id);
    if (!player) return { success: false, error: 'Player not found' };

    this.server.to(roomId).emit('chat-message', {
      playerId: client.id,
      playerName: player.name,
      message: data.message,
      timestamp: Date.now()
    });

    return { success: true };
  }
}
