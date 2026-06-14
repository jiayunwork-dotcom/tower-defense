import { createSignal, onMount, createMemo, For, Show } from 'solid-js';
import { useGameContext } from '../store/game.store';
import { gameSocket } from '../store/game.store';
import type { Room, ReplaySummary, ReplayData } from '../types/game.types';

export default function LobbyScreen() {
  const store = useGameContext();
  const [roomName, setRoomName] = createSignal('');
  const [rooms, setRooms] = createSignal<Room[]>([]);
  const [replays, setReplays] = createSignal<ReplaySummary[]>([]);
  const [activeTab, setActiveTab] = createSignal<'rooms' | 'replays'>('rooms');
  const [isLoading, setIsLoading] = createSignal(false);
  const [isReplaysLoading, setIsReplaysLoading] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal('');
  const [shareLink, setShareLink] = createSignal('');
  const [shareLinkLoading, setShareLinkLoading] = createSignal(false);
  const [selectedCompareIds, setSelectedCompareIds] = createSignal<Set<string>>(new Set());

  const toggleCompareSelect = (gameId: string) => {
    const next = new Set(selectedCompareIds());
    if (next.has(gameId)) {
      next.delete(gameId);
    } else {
      if (next.size >= 2) {
        store.showToast('最多只能选择2条回放进行对比');
        return;
      }
      next.add(gameId);
    }
    setSelectedCompareIds(next);
  };

  const clearCompareSelection = () => {
    setSelectedCompareIds(new Set<string>());
  };

  const compareSelectedCount = createMemo(() => selectedCompareIds().size);

  const startCompare = async () => {
    const ids = Array.from(selectedCompareIds());
    if (ids.length !== 2) {
      store.showToast('请选择2条回放进行对比');
      return;
    }

    setIsReplaysLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        gameSocket.emit('get-replay', { gameId: ids[0] }),
        gameSocket.emit('get-replay', { gameId: ids[1] }),
      ]);

      if (!r1?.success || !r2?.success) {
        setErrorMsg(r1?.error || r2?.error || '加载回放失败');
        return;
      }

      store.setLeftReplay(r1.replay as ReplayData);
      store.setRightReplay(r2.replay as ReplayData);
      store.setIsInCompareMode(true);
      clearCompareSelection();
    } catch (e: any) {
      setErrorMsg(e?.message || '加载回放异常');
    } finally {
      setIsReplaysLoading(false);
    }
  };

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
        store.setReplayStartTimeMs(0);
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

  const openShareLink = async () => {
    const link = shareLink().trim();
    if (!link) {
      store.showToast('请输入分享链接');
      return;
    }

    setShareLinkLoading(true);
    setErrorMsg('');

    try {
      let gameId = '';
      let timeSeconds = 0;

      const replayMatch = link.match(/replay[?&](.*)/);
      let queryPart = replayMatch ? replayMatch[1] : link;
      if (!queryPart.includes('=') && !link.includes('?')) {
        queryPart = link;
      }

      const params = new URLSearchParams(queryPart);
      gameId = params.get('id') || '';
      const t = params.get('t');
      if (t) timeSeconds = parseInt(t, 10) || 0;

      if (!gameId) {
        setErrorMsg('无效的分享链接格式');
        return;
      }

      const result = await gameSocket.emit('get-replay', { gameId });

      if (result && result.success && result.replay) {
        store.setCurrentReplay(result.replay);
        store.setIsInReplayMode(true);
        store.setReplayStartTimeMs(timeSeconds * 1000);
        setShareLink('');
      } else {
        setErrorMsg(result?.error || '无法加载分享的回放');
      }
    } catch (err: any) {
      console.error('[Lobby] Open share link error:', err);
      setErrorMsg(err?.message || '打开分享链接异常');
    } finally {
      setShareLinkLoading(false);
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

      <div class="lobby-share-bar w-full max-w-md">
        <div class="lobby-share-label">🔗 打开分享链接</div>
        <div class="flex gap-sm w-full">
          <input
            type="text"
            placeholder="粘贴回放分享链接，例如 replay?id=xxx&t=120"
            value={shareLink()}
            onInput={(e) => setShareLink(e.target.value)}
            class="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') openShareLink();
            }}
          />
          <button
            class="btn-gold"
            onClick={openShareLink}
            disabled={shareLinkLoading()}
          >
            打开
          </button>
        </div>
      </div>
      
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
          onClick={() => { setActiveTab('rooms'); clearCompareSelection(); setErrorMsg(''); }}
        >
          🎮 可用房间
        </button>
        <button
          classList={{
            'lobby-tab': true,
            'lobby-tab-active': activeTab() === 'replays'
          }}
          onClick={() => { setActiveTab('replays'); setErrorMsg(''); }}
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
              <For each={rooms()}>
                {(room) => (
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
                )}
              </For>
            </div>
          )}
        </div>
      ) : (
        <div class="w-full max-w-md max-h-lg overflow-y-auto p-sm">
          <div class="flex items-center justify-between mb-md">
            <h3 class="lobby-rooms-header mb-0">最近回放</h3>
            <Show when={compareSelectedCount() > 0}>
              <div class="flex gap-sm items-center">
                <span class="text-sm text-muted">
                  已选 {compareSelectedCount()}/2
                </span>
                <button
                  class="btn-secondary py-xs px-sm text-sm"
                  onClick={clearCompareSelection}
                >
                  清除
                </button>
                <button
                  classList={{
                    'btn-primary py-xs px-sm text-sm': true,
                    'opacity-50 cursor-not-allowed': compareSelectedCount() !== 2,
                  }}
                  onClick={startCompare}
                  disabled={compareSelectedCount() !== 2 || isReplaysLoading()}
                >
                  ⚖️ 对比
                </button>
              </div>
            </Show>
          </div>

          <div class="text-xs text-muted mb-sm">
            💡 勾选两条回放后点击「对比」按钮进入对比模式
          </div>

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
              <For each={replays()}>
                {(replay) => {
                  const isSelected = selectedCompareIds().has(replay.gameId);
                  return (
                    <div
                      classList={{
                        'room-list-item replay-list-item': true,
                        'room-list-item-disabled': isReplaysLoading(),
                        'replay-item-selected': isSelected,
                      }}
                    >
                      <label
                        class="replay-compare-checkbox"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCompareSelect(replay.gameId)}
                          disabled={!isSelected && compareSelectedCount() >= 2}
                        />
                      </label>
                      <div
                        class="flex-1 replay-item-content"
                        onClick={() => watchReplay(replay.gameId)}
                      >
                        <div class="text-semibold text-lg mb-xs flex items-center gap-sm">
                          <span>{replay.mapName}</span>
                          <span classList={{
                            'text-xs px-xs py-xxs rounded': true,
                            'bg-green-100 text-green-700': replay.victory,
                            'bg-red-100 text-red-700': !replay.victory
                          }}>
                            {replay.victory ? '胜利' : '失败'}
                          </span>
                          <Show when={(replay.markers?.length ?? 0) > 0}>
                            <span class="text-xs px-xs py-xxs rounded bg-blue-100 text-blue-600">
                              📍 {replay.markers?.length}
                            </span>
                          </Show>
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
                  );
                }}
              </For>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
