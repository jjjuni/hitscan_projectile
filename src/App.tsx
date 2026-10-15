import { useStore } from './store.ts';
import GameView from './components/GameView.tsx';
import RangePanel from './components/RangePanel.tsx';
import Lobby from './components/Lobby.tsx';
import Room from './components/Room.tsx';
import { Hud, WeaponHud, Tally, Center } from './components/Hud.tsx';

export default function App() {
  const mode = useStore(s => s.mode);
  return (
    <>
      <GameView />
      {mode === 'range' && <RangePanel />}
      {mode === 'lobby' && <Lobby />}
      {(mode === 'range' || mode === 'lobby') && <Tally />}
      {mode === 'room' && <Room />}
      {mode === 'game' && <Hud />}
      {mode !== 'room' && <WeaponHud />}
      <Center />
    </>
  );
}
