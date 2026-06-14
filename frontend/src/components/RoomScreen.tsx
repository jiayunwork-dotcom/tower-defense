import { createSignal, onMount, onCleanup } from 'solid-js';
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
  const { state, setRoom, setGame } = useGameContext();
  const [selectedMap, setSelectedMap] = createSignal(state.room?.selectedMap || 'normal');

  const player = () => state.room?.players.find(p => p.id === state.playerId);
  const isHost = () => player()?.isHost;
  const allReady = () => state.room?.players.every(p => p.isReady);

  const toggleReady = async () => {
    const isReady = !player()?.isReady;
    const result = await gameSocket.emit('set-ready', { isReady });
    if (result.success) {
      setRoom(result.room);
    }
  };

  const selectMap = async (mapId: string) => {
    if (!isHost()) return;
    setSelectedMap(mapId);
    const result = await gameSocket.emit('select-map', { mapName: mapId });
    if (result.success) {
      setRoom(result.room);
    }
  };

  const selectSkill = async (skill: SkillType) => {
    const result = await gameSocket.emit('select-skill', { skill });
    if (result.success) {
      setRoom(result.room);
    }
  };

  const startGame = async () => {
    const result = await gameSocket.emit('start-game');
    if (result.success) {
      setGame(result.game);
    }
  };

  const leaveRoom = async () => {
    await gameSocket.emit('leave-room');
    setRoom(null);
  };

  onMount(() => {
    const onPlayerJoined = (data: any) => {
      const room = state.room;
      if (room) {
        setRoom({ ...room, players: data.players });
      }
    };

    const onPlayerLeft = (data: any) => {
      const room = state.room;
      if (room) {
        setRoom({ ...room, players: data.players });
      }
    };

    gameSocket.on('player-joined', onPlayerJoined);
    gameSocket.on('player-left', onPlayerLeft);

    return () => {
      gameSocket.off('player-joined', onPlayerJoined);
      gameSocket.off('player-left', onPlayerLeft);
    };
  });

  const takenSkills = () => {
    const skills: SkillType[] = [];
    state.room?.players.forEach(p => {
      if (p.id !== state.playerId) {
        skills.push(p.skill);
      }
    });
    return skills;
  };

  return (
    <div class="lobby-screen">
      <h1 class="lobby-title">游戏房间</h1>

      <div class="card" style="width: 100%; max-width: 800px;">
        <h2 style="margin-bottom: 20px;">{state.room?.name}</h2>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
          <div>
            <h3 style="margin-bottom: 16px;">玩家列表 ({state.room?.players.length}/{state.room?.maxPlayers})</h3>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              {state.room?.players.map((p, i) => (
                <div 
                  class="player-card" 
                  style={{
                    borderLeft: `4px solid ${['#3b82f6', '#22c55e', '#f59e0b', '#ef4444'][i % 4]}`
                  }}
                >
                  <div class="player-avatar" style={{ background: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444'][i % 4] }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div class="player-info">
                    <div class="player-name">
                      {p.name}
                      {p.isHost && <span style="color: #fbbf24; margin-left: 8px;">👑</span>}
                    </div>
                    <div style="font-size: 11px;">
                      技能: {SKILLS[p.skill]?.name || '无'}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    {p.isReady ? (
                      <span style="color: #22c55e; font-weight: 600;">✓ 准备</span>
                    ) : (
                      <span style="color: rgba(255,255,255,0.5);">未准备</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 style="margin-bottom: 16px;">选择地图</h3>
            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px;">
              {MAP_LIST.map(map => (
                <button
                  class={selectedMap() === map.id ? 'btn-primary' : 'btn-secondary'}
                  style={{ width: '100%', textAlign: 'left' }}
                  onclick={() => selectMap(map.id)}
                  disabled={!isHost()}
                >
                  {map.name} - {map.difficulty}
                </button>
              ))}
            </div>

            <h3 style="margin-bottom: 16px;">选择技能</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px;">
              {(Object.keys(SKILLS) as SkillType[]).map(skill => {
                const isTaken = takenSkills().includes(skill);
                const isSelected = player()?.skill === skill;
                return (
                  <button
                    class={isSelected ? 'btn-gold' : isTaken ? 'btn-secondary' : 'btn-secondary'}
                    style={{ 
                      opacity: isTaken ? 0.5 : 1,
                      cursor: isTaken ? 'not-allowed' : 'pointer'
                    }}
                    onclick={() => !isTaken && selectSkill(skill)}
                    disabled={isTaken}
                  >
                    <div style="font-size: 20px;">{SKILLS[skill].icon}</div>
                    <div style="font-size: 11px;">{SKILLS[skill].name}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 12px; margin-top: 30px; justify-content: center;">
          <button class="btn-secondary" onclick={leaveRoom}>
            离开房间
          </button>
          <button 
            class={allReady() && isHost() ? 'btn-success' : 'btn-primary'}
            onclick={isHost() ? startGame : toggleReady}
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
