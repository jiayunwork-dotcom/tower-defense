import { onMount, onCleanup, createEffect } from 'solid-js';
import { GameProvider, useGameStore, gameSocket } from './store/game.store';
import LobbyScreen from './components/LobbyScreen';
import GameScreen from './components/GameScreen';
import RoomScreen from './components/RoomScreen';

function AppContent() {
  const { state, setRoom, setGame, setPlayerId, addChatMessage } = useGameStore();

  onMount(() => {
    const socket = gameSocket.connect();
    setPlayerId(socket.id || '');
    
    socket.on('connect', () => {
      setPlayerId(socket.id);
    });

    socket.on('player-joined', (data: any) => {
      console.log('Player joined:', data);
    });

    socket.on('player-left', (data: any) => {
      console.log('Player left:', data);
    });

    socket.on('game-started', (data: any) => {
      setGame(data.game);
      setRoom(data.room);
    });

    socket.on('game-state', (data: any) => {
      setGame(data.game);
    });

    socket.on('tower-built', (data: any) => {
      console.log('Tower built:', data);
    });

    socket.on('tower-upgraded', (data: any) => {
      console.log('Tower upgraded:', data);
    });

    socket.on('tower-sold', (data: any) => {
      console.log('Tower sold:', data);
    });

    socket.on('skill-used', (data: any) => {
      console.log('Skill used:', data);
    });

    socket.on('chat-message', (data: any) => {
      addChatMessage(data);
    });

    socket.on('ping-received', (data: any) => {
      console.log('Ping received:', data);
    });
  });

  onCleanup(() => {
    gameSocket.disconnect();
  });

  return (
    <div class="app-container">
      {!state.room && <LobbyScreen />}
      {state.room && !state.game && <RoomScreen />}
      {state.room && state.game && <GameScreen />}
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}
