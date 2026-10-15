import { useEffect, useRef } from 'react';
import { createEngine } from '../game/engine.ts';
import { attachEngine, engineHooks } from '../game/session.ts';

// Hosts the three.js canvas plus the overlays the engine moves every frame
// (crosshair gap, hit marker, scope, damage-direction arcs, damage numbers).
export default function GameView() {
  const mount = useRef<HTMLDivElement>(null), crosshair = useRef<HTMLDivElement>(null), hitmarker = useRef<HTMLDivElement>(null);
  const scope = useRef<HTMLDivElement>(null), hurtRing = useRef<HTMLDivElement>(null), popups = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const engine = createEngine({
      mount: mount.current!, crosshair: crosshair.current!, hitmarker: hitmarker.current!,
      scope: scope.current!, hurtRing: hurtRing.current!, popups: popups.current!,
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
