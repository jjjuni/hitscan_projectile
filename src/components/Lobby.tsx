import { useState, type ChangeEvent, type FormEvent } from 'react';
import type { RoomInfo } from '../../shared/protocol.ts';
import { useStore } from '../store.ts';
import { actions } from '../game/session.ts';

function RoomRow({ r }: { r: RoomInfo }) {
  const full = r.count >= 8;
  const join = () => {
    const password = r.locked ? prompt('비밀번호') : '';
    if (password !== null) actions.join(r.id, password);
  };
  return (
    <li>
      <span aria-label={r.locked ? '비밀방' : undefined}>{r.locked ? '🔒' : ''}</span>
      <span>{r.title}</span>
      <span className="count">{r.count}/8명</span>
      <span className="kills">{r.killLimit}킬</span>
      <button className="ghost" disabled={r.playing || full} onClick={join}>{r.playing ? '게임 중' : full ? '가득 참' : '참가'}</button>
    </li>
  );
}

function CreateForm() {
  const [f, setF] = useState({ title: '', killLimit: 20, secret: false, password: '' });
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    actions.create(f);
  };
  return (
    <form className="create" onSubmit={submit}>
      <label>방 제목 <input maxLength={30} placeholder="비워 두면 '닉네임의 방'" value={f.title} onChange={set('title')} /></label>
      <label>승리 킬 수 <input type="number" min={1} max={100} required value={f.killLimit} onChange={set('killLimit')} /></label>
      <label className="check"><input type="checkbox" checked={f.secret} onChange={set('secret')} /> 비밀방</label>
      <label>비밀번호 <input type="password" maxLength={20} disabled={!f.secret} value={f.password} onChange={set('password')} /></label>
      <p className="mode">사격 방식 <b>Hitscan</b></p>
      <button className="primary">방 만들기</button>
    </form>
  );
}

export default function Lobby() {
  const rooms = useStore(s => s.rooms);
  const nick = useStore(s => s.nick);
  return (
    <div id="lobby" className="sign side">
      <header className="head"><h2>대기실</h2><span className="who">{nick}</span></header>
      <ul className="rooms">
        {rooms.length ? rooms.map(r => <RoomRow key={r.id} r={r} />) : <li className="empty">열린 방이 없습니다. 아래에서 방을 만들어 보세요.</li>}
      </ul>
      <details>
        <summary>방 만들기</summary>
        <CreateForm />
      </details>
      <p className="hint">사격 중에는 Esc로 마우스를 풀어야 방을 고를 수 있습니다</p>
    </div>
  );
}
