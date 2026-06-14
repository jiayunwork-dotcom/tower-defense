import { createSignal, onMount } from 'solid-js';
import { useGameContext } from '../store/game.store';
import { gameSocket } from '../store/game.store';
import type { Room, ReplaySummary } from '../types/game.types';

export default function LobbyScreen() {
  const store = useGameContext();
  const [roomName, setRoomName] = createSignal('');
  const [rooms, setRooms] = createSignal<Room[]>([]);
  const [replays, setReplays] = createSignal<ReplaySummary[]>([]);
  const [activeTab, setActiveTab] = createSignal<'rooms' | 'replays'>('rooms');
  const [isLoading, setIsLoading] = createSignal(false);
  const [isReplaysLoading, setIsReplaysLoading] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal('');

  const createRoom = async () => {
    setIsLoading(true);
    setErrorMsg('');
    
    try {
      const name = roomName() || `房间_${Math.random().toString(36).slice(2, 7)}`;
      console.log('[Lobby] Creating room with name:', name);
      const result = await gameSocket.emit('create-room', { name });
      
      console.log('[Lobby] Create room result:', result);
      if (result && result.success && result.room) {
        store.setRoom(result.room);
      } else {
        setErrorMsg(result?.error || '创建房间失败');
      }
    } catch (err: any) {
      console.error('[Lobby] Create room error:', err);
      setErrorMsg(err?.message || '创建房间异常');
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoom = async (roomId: string) => {
    if (isLoading()) return;
    
    setIsLoading(true);
    setErrorMsg('');
    
    try {
      console.log('[Lobby] Joining room:', roomId);
      const result = await gameSocket.emit('join-room', { roomId });
      console.log('[Lobby] Join room result:', result);
      
      if (result && result.success && result.room) {
        store.setRoom(result.room);
      } else {
        setErrorMsg(result?.error || '加入房间失败');
      }
    } catch (err: any) {
      console.error('[Lobby] Join room error:', err);
      setErrorMsg(err?.message || '加入房间异常');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshRooms = async () => {
    setIsLoading(true);
    try {
      const result = await gameSocket.emit('list-rooms');
      if (result && result.success) {
        setRooms(result.rooms || []);
      }
    } catch (err) {
      console.error('[Lobby] Refresh rooms error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshReplays = async () => {
    setIsReplaysLoading(true);
    try {
      const result = await gameSocket.emit('list-replays');
      if (result && result.success) {
        setReplays(result.replays || []);
        store.setReplayList(result.replays || []);
      }
    } catch (err) {
      console.error('[Lobby] Refresh replays error:', err);
    } finally {
      setIsReplaysLoading(false);
    }
  };

  const watchReplay = async (gameId: string) => {
    setIsReplaysLoading(true);
    setErrorMsg('');
    
    try {
      console.log('[Lobby] Watching replay:', gameId);
      const result = await gameSocket.emit('get-replay', { gameId });
      
      if (result && result.success && result.replay) {
        store.setCurrentReplay(result.replay);
        store.setIsInReplayMode(true);
      } else {
        setErrorMsg(result?.error || '无法加载回放');
      }
    } catch (err: any) {
      console.error('[Lobby] Watch replay error:', err);
      setErrorMsg(err?.message || '加载回放异常');
    } finally {
      setIsReplaysLoading(false);
    }
  };

  const formatDateTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  onMount(() => {
    refreshRooms();
    refreshReplays();
    if (store.kickedMessage) {
      setTimeout(() => {
        store.setKickedMessage(null);
      }, 5000);
    }
  });

  return (
    <div class="lobby-screen">
      <h1 class="lobby-title">🏰 多人塔防</h1>
      
      <div class="lobby-status-bar">
        <p class="text-sm text-muted">
          Player ID: {store.playerId || '(未连接)'}
        </p>
        {isLoading() && <span class="text-warning text-sm">加载中...</span>}
      </div>

      {store.kickedMessage && (
        <div class="lobby-error w-full max-w-md">
          🚫 {store.kickedMessage}
        </div>
      )}

      {errorMsg() && (
        <div class="lobby-error w-full max-w-md">
          ⚠️ {errorMsg()}
        </div>
      )}
      
      <div class="lobby-create-bar">
        <input
          type="text"
          placeholder="输入房间名称..."
          value={roomName()}
          onInput={(e) => setRoomName(e.target.value)}
          class="flex-1"
        />
        <button 
          class="btn-primary" 
          onClick={createRoom}
          disabled={isLoading()}
        >
          创建房间
        </button>
        <button 
          class="btn-secondary" 
          onClick={activeTab() === 'rooms' ? refreshRooms : refreshReplays}
          disabled={isLoading() || isReplaysLoading()}
        >
          刷新列表
        </button>
      </div>

      <div class="lobby-tabs">
        <button
          classList={{
            'lobby-tab': true,
            'lobby-tab-active': activeTab() === 'rooms'
          }}
          onClick={() => setActiveTab('rooms')}
        >
          🎮 可用房间
        </button>
        <button
          classList={{
            'lobby-tab': true,
            'lobby-tab-active': activeTab() === 'replays'
          }}
          onClick={() => setActiveTab('replays')}
        >
          📹 回放列表
        </button>
      </div>

      {activeTab() === 'rooms' ? (
        <div class="w-full max-w-md max-h-lg overflow-y-auto p-sm">
          <h3 class="lobby-rooms-header">可用房间</h3>
          {rooms().length === 0 ? (
            <div class="lobby-rooms-empty">
              暂无可用房间，创建一个吧！
            </div>
          ) : (
            <div>
              {rooms().map((room) => (
                <div
                  onClick={() => joinRoom(room.id)}
                  classList={{
                    'room-list-item': true,
                    'room-list-item-disabled': isLoading()
                  }}
                >
                  <div>
                    <div class="text-semibold text-lg mb-xs">
                      {room.name}
                    </div>
                    <div class="text-sm text-muted">
                      地图: {room.selectedMap}
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-md mb-xs">
                      {room.players.length} / {room.maxPlayers} 人
                    </div>
                    <div class="text-sm text-muted">
                      {room.players.filter(p => p.isReady).length} 人准备
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div class="w-full max-w-md max-h-lg overflow-y-auto p-sm">
          <h3 class="lobby-rooms-header">最近回放</h3>
          {isReplaysLoading() ? (
            <div class="lobby-rooms-empty">
              加载中...
            </div>
          ) : replays().length === 0 ? (
            <div class="lobby-rooms-empty">
              暂无回放记录
            </div>
          ) : (
            <div>
              {replays().map((replay) => (
                <div
                  onClick={() => watchReplay(replay.gameId)}
                  classList={{
                    'room-list-item': true,
                    'room-list-item-disabled': isReplaysLoading()
                  }}
                >
                  <div class="flex-1">
                    <div class="text-semibold text-lg mb-xs flex items-center gap-sm">
                      <span>{replay.mapName}</span>
                      <span classList={{
                        'text-xs px-xs py-xxs rounded': true,
                        'bg-green-100 text-green-700': replay.victory,
                        'bg-red-100 text-red-700': !replay.victory
                      }}>
                        {replay.victory ? '胜利' : '失败'}
                      </span>
                    </div>
                    <div class="text-sm text-muted">
                      {formatDateTime(replay.startTime)}
                    </div>
                    <div class="text-sm text-muted flex gap-md mt-xs">
                      <span>👥 {replay.playerCount}人</span>
                      <span>🌊 第{replay.finalWave}波</span>
                      <span>⏱ {formatDuration(replay.duration)}</span>
                    </div>
                  </div>
                  <div class="text-right">
                    <button class="btn-gold text-sm py-xs px-sm">
                      观看回放
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
