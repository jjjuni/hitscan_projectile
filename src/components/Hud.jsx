import { MAX_HP } from '../../shared/map.js';
import { WEAPONS, SLOTS } from '../../shared/weapons.js';
import { useStore } from '../store.js';

const TEAM_CLASS = { A: 'red', B: 'blue' };

// Match HUD: score, kill feed, health.
export function Hud() {
  const score = useStore(s => s.score);
  const room = useStore(s => s.room);
  const hp = useStore(s => s.hp);
  const feed = useStore(s => s.feed);
  return (
    <div id="hud">
      <div id="score"><b id="sA" className="red">{score.A}</b><span id="goal">{room.killLimit}킬 승리</span><b id="sB" className="blue">{score.B}</b></div>
      <div id="feed">
        {feed.map(f => (
          <div key={f.id}>
            <span className={TEAM_CLASS[f.killer?.team]}>{f.killer?.nick ?? '?'}</span>
            <span className="how"> {WEAPONS[f.weapon]?.name ?? ''}{f.head ? ' 헤드샷' : ''} </span>
            <span className={TEAM_CLASS[f.victim?.team]}>{f.victim?.nick ?? '?'}</span>
          </div>
        ))}
      </div>
      <div id="hp" className={hp <= 25 ? 'low' : ''}><b id="hpNum">{hp}</b><i><i id="hpBar" style={{ width: `${hp / MAX_HP * 100}%` }} /></i></div>
    </div>
  );
}

export function WeaponHud() {
  const { weapon, mag, reloading } = useStore(s => s.ammo);
  const w = WEAPONS[weapon];
  return (
    <div id="weaponHud">
      <ol id="slots">{SLOTS.map((k, i) => <li key={k} className={k === weapon ? 'on' : ''}>{i + 1} {WEAPONS[k].name}</li>)}</ol>
      <div className="ammo"><b id="wMag" className={mag <= Math.ceil(w.mag / 5) ? 'low' : ''}>{mag}</b><span id="wMax">/ {w.mag}</span></div>
      <div><span id="wName">{w.name}</span> <span id="wState">{reloading ? '장전 중' : mag === 0 ? 'R 키로 장전' : ''}</span></div>
    </div>
  );
}

export function Tally() {
  const hits = useStore(s => s.rangeHits);
  return <p id="tally" className="tally">명중 <b>{hits}</b></p>;
}

export function Center() {
  const text = useStore(s => s.center);
  return <div id="center">{text}</div>;
}
