import { createSignal, onMount } from 'solid-js';
import { useGameContext } from '../store/game.store';
import { gameSocket } from '../store/game.store';
import type { Room } from '../types/game.types';

export default function LobbyScreen() {
  const { setRoom } = useGameContext();
  const [roomName, setRoomName] = createSignal('');
  const [rooms, setRooms] = createSignal<Room[]>([]);

  const createRoom = async () => {
    const name = roomName() || `房间_${Math.random().toString(36).slice(2, 7)}`;
    const result = await gameSocket.emit('create-room', { name });
    
    if (result.success) {
      setRoom(result.room);
    }
  };

  const joinRoom = async (roomId: string) => {
    const result = await gameSocket.emit('join-room', { roomId });
    
    if (result.success) {
      setRoom(result.room);
    }
  };

  const refreshRooms = async () => {
    const result = await gameSocket.emit('list-rooms');
    if (result.success) {
      setRooms(result.rooms);
    }
  };

  onMount(() => {
    refreshRooms();
  });

  return (
    <div class="lobby-screen">
      <h1 class="lobby-title">🏰 多人塔防</h1>
      
      <div class="lobby-actions">
        <input
          type="text"
          placeholder="输入房间名称..."
          value={roomName()}
          onInput={(e) => setRoomName(e.target.value)}
        />
        <button class="btn-primary" onclick={createRoom}>
          创建房间
        </button>
        <button class="btn-secondary" onclick={refreshRooms}>
          刷新列表
        </button>
      </div>

      <div class="room-list">
        <h3 style="margin-bottom: 16px; font-size: 18px;">可用房间</h3>
        {rooms().length === 0 ? (
          <p style="color: rgba(255,255,255,0.5); text-align: center; padding: 40px;">
            暂无可用房间，创建一个吧！
          </p>
        ) : (
          rooms().map((room) => (
            <div class="room-item" onclick={() => joinRoom(room.id)}>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 600; font-size: 16px;">{room.name}</div>
                  <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 4px;">
                    地图: {room.selectedMap} | 难度: {room.selectedMap}
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 14px;">
                    {room.players.length} / {room.maxPlayers} 人
                  </div>
                  <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 4px;">
                    {room.players.filter(p => p.isReady).length} 人准备
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
