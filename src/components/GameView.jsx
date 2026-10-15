import { useEffect, useRef } from 'react';
import { createEngine } from '../game/engine.js';
import { attachEngine, engineHooks } from '../game/session.js';

// Hosts the three.js canvas plus the overlays the engine moves every frame
// (crosshair gap, hit marker, scope, damage-direction arcs, damage numbers).
export default function GameView() {
  const mount = useRef(), crosshair = useRef(), hitmarker = useRef(), scope = useRef(), hurtRing = useRef(), popups = useRef();
  useEffect(() => {
    const engine = createEngine({
      mount: mount.current, crosshair: crosshair.current, hitmarker: hitmarker.current,
      scope: scope.current, hurtRing: hurtRing.current, popups: popups.current,
    }, engineHooks);
    attachEngine(engine);
    return () => engine.dispose();
  }, []);
  return (
    <>
      <div ref={mount} />
      <div ref={popups} />
      <div id="scope" className="hidden" ref={scope} />
      <div id="hurtRing" ref={hurtRing} />
      <div id="crosshair" ref={crosshair}><i /><i /><i /><i /></div>
      <div id="hitmarker" className="hidden" ref={hitmarker}>✕</div>
    </>
  );
}
