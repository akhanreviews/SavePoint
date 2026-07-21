import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { IslandScene } from '../three/IslandScene';
import { DEFAULT_POSITION, QUALITY_PRESETS, WORLD_ASSETS, chooseQuality } from './data';
import { useWorldStore } from './store';
import type { QualityTier, WorldPhase } from './types';
import './three.css';

const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

function CharacterModal({ onConfirm }: { onConfirm: () => void }) {
  const [selected, setSelected] = useState(true);
  return <div className="sp-modal-backdrop" role="presentation">
    <section className="sp-modal" role="dialog" aria-modal="true" aria-labelledby="character-title">
      <p className="sp-eyebrow">Choose your traveler</p>
      <h2 id="character-title">Who walks the island?</h2>
      <button type="button" className={`arthur-card ${selected ? 'is-selected' : ''}`} onClick={() => setSelected(true)}>
        <img src={WORLD_ASSETS.arthurAtlas} alt="Pixel-art Arthur Morgan walking" />
        <span><strong>Arthur Morgan</strong><small>Wayfarer of the frontier · first traveler available</small></span>
        <span className="selection-mark" aria-hidden="true">{selected ? '✓' : ''}</span>
      </button>
      <button type="button" className="sp-gold-button" disabled={!selected} onClick={onConfirm}>Drop me on the island <span>↘</span></button>
    </section>
  </div>;
}

function HallModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return <div className="sp-modal-backdrop" role="presentation">
    <section className="sp-modal sp-modal--hall" role="dialog" aria-modal="true" aria-labelledby="hall-title">
      <p className="sp-eyebrow">You found the landmark</p>
      <h2 id="hall-title">Enter the Hall of Fame?</h2>
      <p className="sp-modal-copy">Inside is the cinematic countdown of the ten games that shaped this save point.</p>
      <div className="sp-modal-actions"><button type="button" className="sp-text-button" onClick={onCancel}>Not yet</button><button type="button" className="sp-gold-button" onClick={onConfirm}>Enter Hall <span>↗</span></button></div>
    </section>
  </div>;
}

function WorldHeader({ quality }: { quality: QualityTier }) {
  return <header className="sp-header"><Link to="/" className="sp-logo" aria-label="SavePoint island home"><span className="sp-logo-mark">◆</span><span>SAVEPOINT<small>THE GAME WORLD</small></span></Link><span className="sp-quality">{quality} render</span></header>;
}

function FallbackNav({ onHall }: { onHall: () => void }) {
  return <nav id="world-fallback" className="sp-fallback-nav" aria-label="Accessible world navigation"><p className="sp-eyebrow">Accessible controls</p><button type="button" onClick={onHall}>Go to Hall of Fame</button><a href={`${base}/top-10/`}>Open Top 10 directly</a></nav>;
}

function IntroOverlay({ phase, onEnter }: { phase: WorldPhase; onEnter: () => void }) {
  if (phase !== 'island-ready' && phase !== 'cloud-reveal') return null;
  return <section className="sp-intro-overlay" aria-labelledby="island-title"><p className="sp-eyebrow">A living archive</p><h1 id="island-title">Your games.<br /><em>One island.</em></h1><p>The clouds are moving. Step into a smaller world built from the games you keep coming back to.</p><button type="button" className="sp-gold-button" onClick={onEnter} disabled={phase !== 'island-ready'}>{phase === 'cloud-reveal' ? 'Revealing island…' : 'Enter island'} <span>↘</span></button></section>;
}

function WorldPage() {
  const persisted = useWorldStore((state) => state);
  const [phase, setPhase] = useState<WorldPhase>(persisted.introSeen ? 'exploring' : 'cloud-reveal');
  const [quality] = useState<QualityTier>(chooseQuality);
  const [hallOpen, setHallOpen] = useState(false);
  const [characterOpen, setCharacterOpen] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const lastPersist = useRef(0);

  useEffect(() => {
    const onPageShow = () => {
      setHallOpen(false);
      setPhase((current) => current === 'hall-transition' ? 'exploring' : current);
      persisted.setLandmark(null);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const onPosition = (position: [number, number, number]) => {
    if (performance.now() - lastPersist.current < 400) return;
    lastPersist.current = performance.now();
    persisted.setPosition(position);
  };

  const enterIsland = () => { persisted.beginIntro(); setCharacterOpen(true); };
  const confirmCharacter = () => { persisted.selectArthur(); setCharacterOpen(false); setPhase('camera-descent'); window.setTimeout(() => setPhase('exploring'), 1900); };
  const openHall = () => { if (phase === 'exploring') { persisted.setLandmark('hall-of-fame'); setHallOpen(true); } };
  const confirmHall = () => { setHallOpen(false); setPhase('hall-transition'); window.setTimeout(() => window.location.assign(`${base}/top-10/`), 700); };

  return <main className={`sp-world sp-world--${phase}`}>
    <WorldHeader quality={quality} />
    {!webglFailed && <Canvas shadows dpr={QUALITY_PRESETS[quality].dpr} camera={{ position: [0, 11, 15], fov: 35, near: 0.1, far: 100 }} onCreated={({ gl }) => { gl.setClearColor('#7dc9c8'); }} onError={() => setWebglFailed(true)}>
      <IslandScene phase={phase} quality={quality} atlasUrl={WORLD_ASSETS.arthurAtlas} onRevealComplete={() => setPhase((current) => current === 'cloud-reveal' ? 'island-ready' : current)} onHall={openHall} onPosition={onPosition} position={persisted.playerPosition} />
    </Canvas>}
    <div className={`sp-cloud-scrim ${phase === 'cloud-reveal' ? 'is-active' : ''}`} aria-hidden="true" />
    <div className="sp-grain" aria-hidden="true" />
    <IntroOverlay phase={phase} onEnter={enterIsland} />
    <FallbackNav onHall={openHall} />
    {characterOpen && <CharacterModal onConfirm={confirmCharacter} />}
    {hallOpen && <HallModal onCancel={() => { setHallOpen(false); persisted.setLandmark(null); }} onConfirm={confirmHall} />}
    {webglFailed && <section className="sp-webgl-fallback"><p className="sp-eyebrow">3D unavailable</p><h1>Open the Hall of Fame.</h1><p>Your browser could not start the island renderer, but the archive is still available.</p><a className="sp-gold-button" href={`${base}/top-10/`}>Open Top 10 <span>↗</span></a></section>}
    {phase === 'hall-transition' && <div className="sp-transition" aria-hidden="true"><span>OPENING THE HALL</span></div>}
  </main>;
}

function NotFound() { return <main className="sp-not-found"><p className="sp-eyebrow">The map ends here</p><h1>Unknown district.</h1><Link className="sp-gold-button" to="/">Return to island <span>↗</span></Link></main>; }

export default function App() { return <BrowserRouter basename={base || undefined}><Routes><Route path="/" element={<WorldPage />} /><Route path="/backlog" element={<WorldPage />} /><Route path="*" element={<NotFound />} /></Routes></BrowserRouter>; }
