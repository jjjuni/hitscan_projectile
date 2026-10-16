import type { Team as TeamId } from '../../shared/map.ts';
import type { RoomDetail, RoomPlayer } from '../../shared/protocol.ts';
import { MAPS, MAP_IDS, type MapId } from '../../shared/maps.ts';
import { useStore } from '../store.ts';
import { actions } from '../game/session.ts';

interface TeamProps { team: TeamId; label: string; room: RoomDetail; myId: number | null; mine: RoomPlayer }
function Team({ team, label, room, myId, mine }: TeamProps) {
  const ps = room.players.filter(p => p.team === team);
  return (
    <section className={`team ${team}`}>
      <h3>{label}</h3>
      <ul className="slots">
        {/* Always 4 slots so the open seats are visible. */}
        {[0, 1, 2, 3].map(i => {
          const p = ps[i];
          if (!p) return <li key={`empty-${i}`} className="slot empty"><i className="lamp" /><span className="name">빈 자리</span></li>;
          const host = p.id === room.hostId;
          return (
            <li key={p.id} className={`slot${host || p.ready ? ' on' : ''}`}>
              <i className="lamp" />
              <span className="name">{p.nick}{p.id === myId ? ' (나)' : ''}</span>
              <span className="tag">{host ? '방장' : p.ready ? 'READY' : '준비 중'}</span>
            </li>
          );
        })}
      </ul>
      <button className="ghost" disabled={mine.team === team || ps.length >= 4} onClick={() => actions.team(team)}>{label}로 이동</button>
    </section>
  );
}

export default function Room() {
  const room = useStore(s => s.room);
  const myId = useStore(s => s.myId);
  const result = useStore(s => s.roomResult);
  const mine = room?.players.find(p => p.id === myId);
  if (!room || !mine) return null;
  const isHost = room.hostId === myId;
  const count = (t: TeamId) => room.players.filter(p => p.team === t).length;
  const notReady = room.players.filter(p => p.id !== room.hostId && !p.ready).length;
  const hint = !count('A') || !count('B') ? '양 팀에 1명 이상 있어야 시작할 수 있습니다'
    : notReady ? `${notReady}명이 아직 READY 하지 않았습니다` : isHost ? '시작할 수 있습니다' : '방장이 시작하기를 기다리는 중';
  return (
    <div id="room" className="screen">
      <div className="panel room-panel">
        <header className="head">
          <h2>{room.locked ? '🔒 ' : ''}{room.title}</h2>
          <span className="who">{room.killLimit}킬을 먼저 채운 팀이 승리 (Hitscan)</span>
        </header>
        <div className="mapPick">
          <span>맵</span>
          {isHost
            ? <select value={room.map} onChange={e => actions.map(e.target.value as MapId)}>{MAP_IDS.map(id => <option key={id} value={id}>{MAPS[id].name}</option>)}</select>
            : <b>{MAPS[room.map].name}</b>}
          <span className="hint">{MAPS[room.map].loadout === 'pickup' ? '권총으로 시작, 건물 안 무기를 F로 주워 최대 2자루' : '모든 무기로 시작'}</span>
        </div>
        <div className="versus">
          <Team team="A" label="RED" room={room} myId={myId} mine={mine} />
          <div className="vs" aria-hidden="true">VS</div>
          <Team team="B" label="BLUE" room={room} myId={myId} mine={mine} />
        </div>
        {result && <p id="roomResult">{result}</p>}
        <div className="actions">
          <button className="ghost" onClick={actions.leave}>나가기</button>
          <p id="startHint">{hint}</p>
          {isHost
            ? <button className="primary" disabled={!count('A') || !count('B') || notReady > 0} onClick={actions.start}>START</button>
            : <button className="primary" onClick={actions.ready}>{mine.ready ? 'READY 취소' : 'READY'}</button>}
        </div>
      </div>
    </div>
  );
}
