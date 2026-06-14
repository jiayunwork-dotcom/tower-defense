import { createSignal, onMount } from 'solid-js';
import { useGameContext, gameSocket } from '../store/game.store';
import { SKILLS } from '../constants/game.constants';
import type { SkillType } from '../types/game.types';

const MAP_LIST = [
  { id: 'easy', name: '简单模式', difficulty: '简单' },
  { id: 'normal', name: '普通模式', difficulty: '普通' },
  { id: 'hard', name: '困难模式', difficulty: '困难' },
  { id: 'hell', name: '地狱模式', difficulty: '地狱' },
  { id: 'endless', name: '无尽模式', difficulty: '无尽' },
];

export default function RoomScreen() {
  const store = useGameContext();
  const [selectedMap, setSelectedMap] = createSignal(store.room?.selectedMap || 'normal');
  const [errorMsg, setErrorMsg] = createSignal('');

  const player = () => store.room?.players.find(p => p.id === store.playerId);
  const isHost = () => player()?.isHost;
  const allReady = () => store.room?.players.every(p => p.isReady);
  const playerCount = () => store.room?.players.length || 0;

  const toggleReady = async () => {
    setErrorMsg('');
    const isReady = !player()?.isReady;
    const result = await gameSocket.emit('set-ready', { isReady });
    if (result.success) {
      store.setRoom(result.room);
    } else {
      setErrorMsg(result.error || '操作失败');
    }
  };

  const selectMap = async (mapId: string) => {
    if (!isHost()) return;
    setSelectedMap(mapId);
    const result = await gameSocket.emit('select-map', { mapName: mapId });
    if (result.success) {
      store.setRoom(result.room);
    }
  };

  const selectSkill = async (skill: SkillType) => {
    setErrorMsg('');
    const result = await gameSocket.emit('select-skill', { skill });
    if (!result.success) {
      setErrorMsg(result.error || '技能已被占用');
    }
  };

  const startGame = async () => {
    setErrorMsg('');
    const result = await gameSocket.emit('start-game');
    if (!result.success) {
      setErrorMsg(result.error || '开始游戏失败，请确保所有玩家已准备');
    }
  };

  const leaveRoom = async () => {
    await gameSocket.emit('leave-room');
    store.setRoom(null);
    store.setGame(null);
  };

  onMount(() => {
    const onPlayerJoined = (data: any) => {
      console.log('[Room] Player joined:', data);
      if (store.room) {
        store.updateRoom({ players: data.players });
      }
    };
    const onPlayerLeft = (data: any) => {
      console.log('[Room] Player left:', data);
      if (store.room) {
        store.updateRoom({ players: data.players });
      }
    };

    gameSocket.on('player-joined', onPlayerJoined);
    gameSocket.on('player-left', onPlayerLeft);

    const cleanup = () => {
      gameSocket.off('player-joined', onPlayerJoined);
      gameSocket.off('player-left', onPlayerLeft);
    };
    
    // SolidJS onMount 返回值自动作为清理函数
    return cleanup;
  });

  const takenSkills = (): SkillType[] => {
    const skills: SkillType[] = [];
    store.room?.players.forEach(p => {
      if (p.id !== store.playerId) {
        skills.push(p.skill);
      }
    });
    return skills;
  };

  return (
    <div class="room-screen-wrap">
      <h1 class="lobby-title">游戏房间</h1>

      {errorMsg() && (
        <div class="lobby-error w-full max-w-md">
          ⚠️ {errorMsg()}
        </div>
      )}

      <div class="room-card">
        <h2 class="room-card-title">{store.room?.name}</h2>

        <div class="room-content-grid">
          <div>
            <h3 class="room-section-title">
              玩家列表 ({playerCount()}/{store.room?.maxPlayers})
            </h3>
            <div class="room-player-list">
              {store.room?.players.map((p, i) => {
                const colorIdx = i % 4;
                return (
                  <div 
                    class={`room-player-card color-${colorIdx}`}
                  >
                    <div class={`room-player-avatar avatar-${colorIdx}`}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="room-player-info">
                      <div class="room-player-name">
                        {p.name}
                        {p.isHost && <span class="text-gold ml-sm">👑</span>}
                      </div>
                      <div class="room-player-skill">
                        技能: {SKILLS[p.skill]?.name || '无'}
                      </div>
                    </div>
                    <div class="room-player-status">
                      {p.isReady ? (
                        <span class="status-ready">✓ 准备</span>
                      ) : (
                        <span class="status-not-ready">未准备</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 class="room-section-title">选择地图</h3>
            <div class="room-map-list">
              {MAP_LIST.map(map => {
                const isSelected = (store.room?.selectedMap || 'normal') === map.id;
                const btnClass = isSelected ? 'btn-primary' : 'btn-secondary';
                return (
                  <button
                    class={`${btnClass} room-map-btn`}
                    onClick={() => selectMap(map.id)}
                    disabled={!isHost()}
                  >
                    {map.name} - {map.difficulty}
                  </button>
                );
              })}
            </div>

            <h3 class="room-section-title">选择技能</h3>
            <div class="room-skill-grid">
              {(Object.keys(SKILLS) as SkillType[]).map(skill => {
                const isTaken = takenSkills().includes(skill);
                const isSelected = player()?.skill === skill;
                const btnBaseClass = isSelected ? 'btn-gold' : 'btn-secondary';
                return (
                  <button
                    class={`${btnBaseClass} room-skill-btn ${isTaken ? 'disabled' : ''}`}
                    onClick={() => !isTaken && selectSkill(skill)}
                    disabled={isTaken}
                    title={`${SKILLS[skill].name}: ${SKILLS[skill].description}`}
                  >
                    <span class="skill-icon">{SKILLS[skill].icon}</span>
                    <span class="skill-name">{SKILLS[skill].name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div class="room-actions">
          <button class="btn-secondary" onClick={leaveRoom}>
            离开房间
          </button>
          <button 
            class={`${allReady() && isHost() ? 'btn-success' : 'btn-primary'}`}
            onClick={() => isHost() ? startGame() : toggleReady()}
            disabled={isHost() ? !allReady() : false}
          >
            {isHost() 
              ? (allReady() ? '开始游戏' : '等待玩家准备')
              : (player()?.isReady ? '取消准备' : '准备')
            }
          </button>
        </div>
      </div>
    </div>
  );
}
