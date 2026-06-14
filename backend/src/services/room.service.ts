import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Room, Player, GameState, SkillType } from '../types/game.types';
import { RedisService } from './redis.service';
import { GameEngineService } from './game-engine.service';
import { ReplayService } from './replay.service';

@Injectable()
export class RoomService {
  private rooms: Map<string, Room> = new Map();

  constructor(
    private redisService: RedisService,
    private gameEngineService: GameEngineService,
    private replayService: ReplayService
  ) {}

  createRoom(name: string, hostId: string, hostName: string, maxPlayers: number = 4): Room {
    const roomId = uuidv4();
    
    const host: Player = {
      id: hostId,
      name: hostName,
      isHost: true,
      isReady: false,
      color: '',
      assignedPaths: [],
      areaBounds: { x: 0, y: 0, width: 0, height: 0 },
      skill: 'freeze',
      skillCooldown: 0,
      kills: 0,
      isConnected: true
    };

    const room: Room = {
      id: roomId,
      name,
      hostId,
      players: [host],
      maxPlayers,
      game: null,
      selectedMap: 'normal',
      isLocked: false,
      createdAt: Date.now()
    };

    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(roomId: string, playerId: string, playerName: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    if (room.players.length >= room.maxPlayers) return null;
    if (room.players.some(p => p.id === playerId)) return room;
    
    const availableSkills: SkillType[] = ['freeze', 'meteor', 'repair', 'gold'];
    const takenSkills = room.players.map(p => p.skill);
    const freeSkill = availableSkills.find(s => !takenSkills.includes(s)) || 'freeze';

    const player: Player = {
      id: playerId,
      name: playerName,
      isHost: false,
      isReady: false,
      color: '',
      assignedPaths: [],
      areaBounds: { x: 0, y: 0, width: 0, height: 0 },
      skill: freeSkill,
      skillCooldown: 0,
      kills: 0,
      isConnected: true
    };

    room.players.push(player);
    return room;
  }

  leaveRoom(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return false;

    const isHost = room.players[playerIndex].isHost;
    room.players.splice(playerIndex, 1);

    if (room.players.length === 0) {
      this.deleteRoom(roomId);
    } else if (isHost) {
      room.players[0].isHost = true;
      room.hostId = room.players[0].id;
    }

    return true;
  }

  setPlayerReady(roomId: string, playerId: string, isReady: boolean): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return null;

    player.isReady = isReady;
    return room;
  }

  setSelectedMap(roomId: string, playerId: string, mapName: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.hostId !== playerId) return null;

    room.selectedMap = mapName;
    return room;
  }

  setPlayerSkill(roomId: string, playerId: string, skill: SkillType): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const skillTaken = room.players.some(p => p.id !== playerId && p.skill === skill);
    if (skillTaken) return null;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return null;

    player.skill = skill;
    return room;
  }

  canStartGame(room: Room): boolean {
    if (room.players.length < 2) return false;
    return room.players.every(p => p.isReady);
  }

  startGame(roomId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (!this.canStartGame(room)) return null;

    const game = this.gameEngineService.createGame(
      roomId,
      room.selectedMap,
      room.players
    );

    room.game = game;
    
    this.gameEngineService.startGameLoop(roomId, (game) => {
      // Game state updates will be broadcast via WebSocket
    });

    return room;
  }

  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) || null;
  }

  deleteRoom(roomId: string): boolean {
    this.gameEngineService.removeGame(roomId);
    return this.rooms.delete(roomId);
  }

  listRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(r => !r.isLocked && !r.game);
  }

  findRoomByPlayer(playerId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.players.some(p => p.id === playerId)) {
        return room;
      }
    }
    return null;
  }

  kickPlayer(roomId: string, hostId: string, targetPlayerId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.hostId !== hostId) return null;
    if (room.hostId === targetPlayerId) return null;

    const playerIndex = room.players.findIndex(p => p.id === targetPlayerId);
    if (playerIndex === -1) return null;

    room.players.splice(playerIndex, 1);
    return room;
  }
}
