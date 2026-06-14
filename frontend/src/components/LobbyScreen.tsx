import { createSignal, onMount } from 'solid-js';
import { useGameContext } from '../store/game.store';
import { gameSocket } from '../store/game.store';
import type { Room } from '../types/game.types';

export default function LobbyScreen() {
  const store = useGameContext();
  const [roomName, setRoomName] = createSignal('');
  const [rooms, setRooms] = createSignal<Room[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
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

  onMount(() => {
    refreshRooms();
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
          onClick={refreshRooms}
          disabled={isLoading()}
        >
          刷新列表
        </button>
      </div>

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
    </div>
  );
}
