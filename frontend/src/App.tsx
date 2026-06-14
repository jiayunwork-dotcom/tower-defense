import { onMount, onCleanup } from 'solid-js';
import { GameContext, createGameStore, gameSocket } from './store/game.store';
import type { GameStore } from './store/game.store';
import LobbyScreen from './components/LobbyScreen';
import GameScreen from './components/GameScreen';
import RoomScreen from './components/RoomScreen';
import ReplayScreen from './components/ReplayScreen';

export default function App() {
  const store: GameStore = createGameStore();

  onMount(() => {
    console.log('App mounted, initializing WebSocket...');
    
    try {
      const socket = gameSocket.connect();
      
      store.setPlayerId(gameSocket.getId());

      socket.on('connect', () => {
        console.log('Socket connected, setting player ID:', gameSocket.getId());
        store.setPlayerId(gameSocket.getId());
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      socket.on('player-joined', (data: any) => {
        console.log('Player joined event:', data);
        store.updateRoom({ players: data.players });
      });

      socket.on('player-left', (data: any) => {
        console.log('Player left event:', data);
        store.updateRoom({ players: data.players });
      });

      socket.on('player-ready-changed', (data: any) => {
        console.log('Player ready changed:', data);
        store.updateRoom({ players: data.players });
      });

      socket.on('map-changed', (data: any) => {
        console.log('Map changed:', data);
        if (data.room) {
          store.setRoom(data.room);
        }
      });

      socket.on('player-skill-changed', (data: any) => {
        console.log('Player skill changed:', data);
        store.updateRoom({ players: data.players });
      });

      socket.on('game-started', (data: any) => {
        console.log('Game started:', data);
        store.setRoom(data.room);
        store.setGame(data.game);
      });

      socket.on('game-state', (data: any) => {
        store.setGame(data.game);
      });

      socket.on('tower-built', (data: any) => {
        store.updateGame({ gold: data.gold });
      });

      socket.on('tower-upgraded', (data: any) => {
        store.updateGame({ gold: data.gold });
      });

      socket.on('tower-sold', (data: any) => {
        store.updateGame({ gold: data.gold });
      });

      socket.on('skill-used', (data: any) => {
        console.log('Skill used:', data);
      });

      socket.on('chat-message', (data: any) => {
        store.addChatMessage(data);
      });

      socket.on('kicked', (data: any) => {
        console.log('Kicked from room:', data);
        store.setKickedMessage(data.message || '你已被房主踢出房间');
        store.setRoom(null);
        store.setGame(null);
      });

      socket.on('skip-wave-vote', (data: any) => {
        store.updateGame({ skipWaveVote: data.votes });
      });

      socket.on('speed-vote', (data: any) => {
        store.updateGame({ 
          gameSpeed: data.currentSpeed,
          speedVote: data.speedVotes 
        });
      });

    } catch (err) {
      console.error('Error initializing app:', err);
    }
  });

  onCleanup(() => {
    console.log('App cleanup, disconnecting socket');
    gameSocket.disconnect();
  });

  const currentScreen = () => {
    if (store.isInReplayMode) {
      return <ReplayScreen />;
    }
    
    const room = store.room;
    const game = store.game;
    
    if (!room) {
      return <LobbyScreen />;
    } else if (!game) {
      return <RoomScreen />;
    } else {
      return <GameScreen />;
    }
  };

  return (
    <GameContext.Provider value={store}>
      <div class="app-container">
        {currentScreen()}
      </div>
    </GameContext.Provider>
  );
}
