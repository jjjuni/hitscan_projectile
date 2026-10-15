import { Fragment, useState } from 'react';
import { connect } from '../game/session.js';

const KEYS = [
  ['클릭', '조준, 사격'], ['우클릭', '조준 (누르고 있기)'], ['WASD', '이동'], ['Shift', '천천히 걷기'],
  ['C', '앉기 (누르고 있기)'], ['Space', '점프'], ['1~4', '무기 교체'], ['R', '장전'], ['Esc', '마우스 해제'],
];

export default function RangePanel() {
  const [nick, setNick] = useState('');
  const submit = e => {
    e.preventDefault();
    if (nick.trim()) connect(nick.trim());
  };
  return (
    <div id="nickPanel" className="sign">
      <h1>사격장</h1>
      <form onSubmit={submit}>
        <label htmlFor="nick">닉네임을 정하면 대기실로 이동합니다</label>
        <div className="row">
          <input id="nick" maxLength={16} placeholder="닉네임" autoComplete="off" value={nick} onChange={e => setNick(e.target.value)} />
          <button className="primary">대기실 입장</button>
        </div>
      </form>
      <dl className="keys">
        {KEYS.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
      </dl>
    </div>
  );
}
