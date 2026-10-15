import { useStore } from './store.js';
import GameView from './components/GameView.jsx';
import RangePanel from './components/RangePanel.jsx';
import Lobby from './components/Lobby.jsx';
import Room from './components/Room.jsx';
import { Hud, WeaponHud, Tally, Center } from './components/Hud.jsx';

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
