import { io, Socket } from 'socket.io-client';
import { createContext, useContext } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { 
  Game, Room, TowerType, TargetStrategy, SkillType, 
  ChatMessage, ReplaySummary, ReplayData,
  PlayerAchievementProgress, LeaderboardEntry, AchievementDef,
  SeasonInfo, LeaderboardScope
} from '../types/game.types';

class GameSocket {
  private socket: Socket | null = null;

  connect(): Socket {
    if (this.socket) return this.socket;

    // Socket.io 的 namespace 和 path 是两个概念：
    // - namespace: /game（逻辑命名空间，NestJS @WebSocketGateway namespace 配置）
    // - path: /socket.io（实际握手 HTTP 路径，由 Vite 代理转发到 :3000）
    // 
    // 注意：开发模式下 Vite 代理 /socket.io 到后端
    // WebSocket 升级 (ws://) 在通过 Vite 代理时有时会有问题
    // 所以先 polling，再升级到 websocket
    const socketOptions: any = {
      transports: import.meta.env.DEV ? ['polling', 'websocket'] : ['polling', 'websocket'],
      withCredentials: !import.meta.env.DEV,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      timeout: 10000,
      // 明确指定 path，避免与 namespace 混淆
      path: '/socket.io',
    };

    // namespace 为 '/game'，实际请求路径是 /socket.io/?EIO=...&ns=%2Fgame
    const namespaceUrl = '/game';
    
    console.log('[GameSocket] Connecting. Namespace:', namespaceUrl, 'Options:', socketOptions);
    this.socket = io(namespaceUrl, socketOptions);

    this.socket.on('connect', () => {
      console.log('WebSocket connected, id:', this.socket?.id);
    });

    this.socket.on('connect_error', (err) => {
      console.error('WebSocket connect error:', err);
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
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

  getId(): string {
    return this.socket?.id || '';
  }

  emit(event: string, data?: any): Promise<any> {
    return new Promise((resolve) => {
      if (!this.socket) {
        console.warn('Socket not connected, cannot emit:', event);
        resolve({ success: false, error: 'Not connected' });
        return;
      }
      console.log('Emitting:', event, data);
      this.socket.timeout(5000).emit(event, data, (err: any, response: any) => {
        if (err) {
          console.error('Emit timeout or error:', event, err);
          resolve({ success: false, error: 'Request timeout' });
          return;
        }
        console.log('Response for', event, ':', response);
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

export interface GameStoreState {
  room: Room | null;
  game: Game | null;
  playerId: string;
  selectedTowerType: TowerType | null;
  selectedTowerId: string | null;
  chatMessages: ChatMessage[];
  kickedMessage: string | null;
  replayList: ReplaySummary[];
  currentReplay: ReplayData | null;
  isInReplayMode: boolean;
  replayStartTimeMs: number;
  isInCompareMode: boolean;
  leftReplay: ReplayData | null;
  rightReplay: ReplayData | null;
  toastMessage: string | null;
  achievements: PlayerAchievementProgress[];
  seasonInfo: SeasonInfo | null;
  leaderboardScope: LeaderboardScope;
  leaderboardKills: LeaderboardEntry[];
  leaderboardWaves: LeaderboardEntry[];
  leaderboardWins: LeaderboardEntry[];
  seasonLeaderboardKills: LeaderboardEntry[];
  seasonLeaderboardWaves: LeaderboardEntry[];
  seasonLeaderboardWins: LeaderboardEntry[];
  achievementNotifications: AchievementDef[];
  showAchievementModal: boolean;
}

export interface GameStoreActions {
  setRoom: (room: Room | null) => void;
  setGame: (game: Game | null) => void;
  setPlayerId: (id: string) => void;
  setSelectedTowerType: (type: TowerType | null) => void;
  setSelectedTowerId: (id: string | null) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setKickedMessage: (msg: string | null) => void;
  updateGame: (patch: Partial<Game>) => void;
  updateRoom: (patch: Partial<Room>) => void;
  setReplayList: (list: ReplaySummary[]) => void;
  setCurrentReplay: (replay: ReplayData | null) => void;
  setIsInReplayMode: (value: boolean) => void;
  setReplayStartTimeMs: (ms: number) => void;
  setIsInCompareMode: (value: boolean) => void;
  setLeftReplay: (replay: ReplayData | null) => void;
  setRightReplay: (replay: ReplayData | null) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
  setAchievements: (achievements: PlayerAchievementProgress[]) => void;
  setSeasonInfo: (info: SeasonInfo | null) => void;
  setLeaderboardScope: (scope: LeaderboardScope) => void;
  setLeaderboardKills: (entries: LeaderboardEntry[]) => void;
  setLeaderboardWaves: (entries: LeaderboardEntry[]) => void;
  setLeaderboardWins: (entries: LeaderboardEntry[]) => void;
  setSeasonLeaderboardKills: (entries: LeaderboardEntry[]) => void;
  setSeasonLeaderboardWaves: (entries: LeaderboardEntry[]) => void;
  setSeasonLeaderboardWins: (entries: LeaderboardEntry[]) => void;
  addAchievementNotification: (achievement: AchievementDef) => void;
  removeAchievementNotification: (id: string) => void;
  setShowAchievementModal: (show: boolean) => void;
  fetchAchievements: () => Promise<void>;
  fetchSeasonInfo: () => Promise<void>;
  fetchLeaderboard: (type: string, scope?: LeaderboardScope) => Promise<void>;
}

export type GameStore = GameStoreState & GameStoreActions;

const initialState: GameStoreState = {
  room: null,
  game: null,
  playerId: '',
  selectedTowerType: null,
  selectedTowerId: null,
  chatMessages: [],
  kickedMessage: null,
  replayList: [],
  currentReplay: null,
  isInReplayMode: false,
  replayStartTimeMs: 0,
  isInCompareMode: false,
  leftReplay: null,
  rightReplay: null,
  toastMessage: null,
  achievements: [],
  seasonInfo: null,
  leaderboardScope: 'alltime',
  leaderboardKills: [],
  leaderboardWaves: [],
  leaderboardWins: [],
  seasonLeaderboardKills: [],
  seasonLeaderboardWaves: [],
  seasonLeaderboardWins: [],
  achievementNotifications: [],
  showAchievementModal: false,
};

let toastTimer: number | null = null;

export function createGameStore(): GameStore {
  const [state, setState] = createStore<GameStoreState>(initialState);

  const setRoom = (room: Room | null) => {
    setState('room', room);
  };

  const setGame = (game: Game | null) => {
    setState('game', game);
  };

  const setPlayerId = (id: string) => {
    setState('playerId', id);
  };

  const setSelectedTowerType = (type: TowerType | null) => {
    setState('selectedTowerType', type);
  };

  const setSelectedTowerId = (id: string | null) => {
    setState('selectedTowerId', id);
  };

  const addChatMessage = (msg: ChatMessage) => {
    setState('chatMessages', (prev) => [...prev, msg].slice(-50));
  };

  const setKickedMessage = (msg: string | null) => {
    setState('kickedMessage', msg);
  };

  const updateGame = (patch: Partial<Game>) => {
    setState('game', (prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateRoom = (patch: Partial<Room>) => {
    setState('room', (prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const setReplayList = (list: ReplaySummary[]) => {
    setState('replayList', list);
  };

  const setCurrentReplay = (replay: ReplayData | null) => {
    setState('currentReplay', replay);
  };

  const setIsInReplayMode = (value: boolean) => {
    setState('isInReplayMode', value);
  };

  const setReplayStartTimeMs = (ms: number) => {
    setState('replayStartTimeMs', ms);
  };

  const setIsInCompareMode = (value: boolean) => {
    setState('isInCompareMode', value);
  };

  const setLeftReplay = (replay: ReplayData | null) => {
    setState('leftReplay', replay);
  };

  const setRightReplay = (replay: ReplayData | null) => {
    setState('rightReplay', replay);
  };

  const showToast = (msg: string) => {
    setState('toastMessage', msg);
    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }
    toastTimer = window.setTimeout(() => {
      setState('toastMessage', null);
      toastTimer = null;
    }, 2000);
  };

  const clearToast = () => {
    setState('toastMessage', null);
    if (toastTimer) {
      window.clearTimeout(toastTimer);
      toastTimer = null;
    }
  };

  const setAchievements = (achievements: PlayerAchievementProgress[]) => {
    setState('achievements', achievements);
  };

  const setSeasonInfo = (info: SeasonInfo | null) => {
    setState('seasonInfo', info);
  };

  const setLeaderboardScope = (scope: LeaderboardScope) => {
    setState('leaderboardScope', scope);
  };

  const setLeaderboardKills = (entries: LeaderboardEntry[]) => {
    setState('leaderboardKills', entries);
  };

  const setLeaderboardWaves = (entries: LeaderboardEntry[]) => {
    setState('leaderboardWaves', entries);
  };

  const setLeaderboardWins = (entries: LeaderboardEntry[]) => {
    setState('leaderboardWins', entries);
  };

  const setSeasonLeaderboardKills = (entries: LeaderboardEntry[]) => {
    setState('seasonLeaderboardKills', entries);
  };

  const setSeasonLeaderboardWaves = (entries: LeaderboardEntry[]) => {
    setState('seasonLeaderboardWaves', entries);
  };

  const setSeasonLeaderboardWins = (entries: LeaderboardEntry[]) => {
    setState('seasonLeaderboardWins', entries);
  };

  const addAchievementNotification = (achievement: AchievementDef) => {
    setState('achievementNotifications', (prev) => [...prev, achievement]);
  };

  const removeAchievementNotification = (id: string) => {
    setState('achievementNotifications', (prev) => prev.filter(a => a.id !== id));
  };

  const setShowAchievementModal = (show: boolean) => {
    setState('showAchievementModal', show);
  };

  const fetchAchievements = async () => {
    const response = await gameSocket.emit('get-player-achievements', {});
    if (response.success) {
      setAchievements(response.achievements);
      if (response.seasonInfo) {
        setSeasonInfo(response.seasonInfo);
      }
    }
  };

  const fetchSeasonInfo = async () => {
    const response = await gameSocket.emit('get-season-info', {});
    if (response.success) {
      setSeasonInfo(response.seasonInfo);
    }
  };

  const fetchLeaderboard = async (type: string, scope?: LeaderboardScope) => {
    const actualScope = scope || state.leaderboardScope;
    const response = await gameSocket.emit('get-leaderboard', { 
      type, 
      scope: actualScope, 
      limit: 20,
      playerId: state.playerId
    });
    if (response.success) {
      if (response.scope === 'season') {
        switch (type) {
          case 'kills':
            setSeasonLeaderboardKills(response.entries);
            break;
          case 'waves':
            setSeasonLeaderboardWaves(response.entries);
            break;
          case 'wins':
            setSeasonLeaderboardWins(response.entries);
            break;
        }
      } else {
        switch (type) {
          case 'kills':
            setLeaderboardKills(response.entries);
            break;
          case 'waves':
            setLeaderboardWaves(response.entries);
            break;
          case 'wins':
            setLeaderboardWins(response.entries);
            break;
        }
      }
    }
  };

  return {
    get room() { return state.room; },
    get game() { return state.game; },
    get playerId() { return state.playerId; },
    get selectedTowerType() { return state.selectedTowerType; },
    get selectedTowerId() { return state.selectedTowerId; },
    get chatMessages() { return state.chatMessages; },
    get kickedMessage() { return state.kickedMessage; },
    get replayList() { return state.replayList; },
    get currentReplay() { return state.currentReplay; },
    get isInReplayMode() { return state.isInReplayMode; },
    get replayStartTimeMs() { return state.replayStartTimeMs; },
    get isInCompareMode() { return state.isInCompareMode; },
    get leftReplay() { return state.leftReplay; },
    get rightReplay() { return state.rightReplay; },
    get toastMessage() { return state.toastMessage; },
    get achievements() { return state.achievements; },
    get seasonInfo() { return state.seasonInfo; },
    get leaderboardScope() { return state.leaderboardScope; },
    get leaderboardKills() { return state.leaderboardKills; },
    get leaderboardWaves() { return state.leaderboardWaves; },
    get leaderboardWins() { return state.leaderboardWins; },
    get seasonLeaderboardKills() { return state.seasonLeaderboardKills; },
    get seasonLeaderboardWaves() { return state.seasonLeaderboardWaves; },
    get seasonLeaderboardWins() { return state.seasonLeaderboardWins; },
    get achievementNotifications() { return state.achievementNotifications; },
    get showAchievementModal() { return state.showAchievementModal; },
    setRoom,
    setGame,
    setPlayerId,
    setSelectedTowerType,
    setSelectedTowerId,
    addChatMessage,
    setKickedMessage,
    updateGame,
    updateRoom,
    setReplayList,
    setCurrentReplay,
    setIsInReplayMode,
    setReplayStartTimeMs,
    setIsInCompareMode,
    setLeftReplay,
    setRightReplay,
    showToast,
    clearToast,
    setAchievements,
    setSeasonInfo,
    setLeaderboardScope,
    setLeaderboardKills,
    setLeaderboardWaves,
    setLeaderboardWins,
    setSeasonLeaderboardKills,
    setSeasonLeaderboardWaves,
    setSeasonLeaderboardWins,
    addAchievementNotification,
    removeAchievementNotification,
    setShowAchievementModal,
    fetchAchievements,
    fetchSeasonInfo,
    fetchLeaderboard,
    _state: state
  } as GameStore;
}

export const GameContext = createContext<GameStore>();

export const useGameContext = (): GameStore => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGameContext must be used within GameProvider');
  return ctx;
};
