import { io, Socket } from 'socket.io-client';
import { createSignal, createContext, useContext, Component, children } from 'solid-js';
import type { Game, Room, TowerType, TargetStrategy, SkillType } from '../types/game.types';

class GameSocket {
  private socket: Socket | null = null;

  connect(): Socket {
    if (this.socket) return this.socket;
    
    this.socket = io('/game', {
      transports: ['websocket', 'polling']
    });
    
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  emit(event: string, data?: any): Promise<any> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }
      this.socket.emit(event, data, (response: any) => {
        resolve(response);
      });
    });
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.on(event, callback);
  }

  off(event: string, callback?: (data: any) => void): void {
    if (!this.socket) return;
    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.removeAllListeners(event);
    }
  }
}

export const gameSocket = new GameSocket();

interface GameStore {
  room: Room | null;
  game: Game | null;
  playerId: string;
  selectedTowerType: TowerType | null;
  selectedTowerId: string | null;
  chatMessages: { playerId: string; playerName: string; message: string; timestamp: number }[];
}

const initialState: GameStore = {
  room: null,
  game: null,
  playerId: '',
  selectedTowerType: null,
  selectedTowerId: null,
  chatMessages: []
};

const [state, setState] = createSignal<GameStore>(initialState);

export const useGameStore = () => {
  const setRoom = (room: Room | null) => {
    setState(prev => ({ ...prev, room }));
  };

  const setGame = (game: Game | null) => {
    setState(prev => ({ ...prev, game }));
  };

  const setPlayerId = (id: string) => {
    setState(prev => ({ ...prev, playerId: id }));
  };

  const setSelectedTowerType = (type: TowerType | null) => {
    setState(prev => ({ ...prev, selectedTowerType: type }));
  };

  const setSelectedTowerId = (id: string | null) => {
    setState(prev => ({ ...prev, selectedTowerId: id }));
  };

  const addChatMessage = (msg: { playerId: string; playerName: string; message: string; timestamp: number }) => {
    setState(prev => ({
      ...prev,
      chatMessages: [...prev.chatMessages, msg].slice(-50)
    }));
  };

  return {
    state,
    setRoom,
    setGame,
    setPlayerId,
    setSelectedTowerType,
    setSelectedTowerId,
    addChatMessage
  };
};

export const GameContext = createContext<ReturnType<typeof useGameStore>>();

export const useGameContext = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGameContext must be used within GameProvider');
  return ctx;
};

export const GameProvider: Component<{ children: any }> = (props) => {
  const store = useGameStore();
  return (
    <GameContext.Provider value={store}>
      {props.children}
    </GameContext.Provider>
  );
};
