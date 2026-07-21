import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { QualityTier, WorldPhase } from '../world/types';
import { QUALITY_PRESETS } from '../world/data';

type Point3 = [number, number, number];
type SceneProps = { phase: WorldPhase; quality: QualityTier; atlasUrl: string; position: Point3; onRevealComplete: () => void; onHall: () => void; onPosition: (position: Point3) => void };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const foliageLocations: Point3[] = [
  [-5.5, 0, -2.8], [-4.8, 0, -4.3], [-4.2, 0, -1.2], [-3.6, 0, 2.2], [-2.7, 0, 4], [-1.4, 0, 3.5],
  [1.6, 0, 3.9], [2.8, 0, 4.5], [4.2, 0, 3.4], [5.5, 0, 2.6], [5.3, 0, .2], [4.4, 0, -1.9],
  [4.8, 0, -3.9], [2.7, 0, -4.4], [1.1, 0, -4.7], [-1.5, 0, -4.4], [-5.6, 0, 1.2], [5.8, 0, 1.3],
];

function CloudLayer({ active, count, onComplete }: { active: boolean; count: number; onComplete: () => void }) {
  const cloudRef = useRef<THREE.Group>(null);
  const started = useRef(false);
  const complete = useRef(false);
  const clouds = useMemo(() => Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const radius = 5.5 + (index % 4) * 1.2;
    return { position: [Math.cos(angle) * radius, 2.1 + (index % 3) * .6, Math.sin(angle) * radius] as Point3, direction: new THREE.Vector3(Math.cos(angle), .04, Math.sin(angle)).multiplyScalar(4.2) };
  }), [count]);

  useFrame((_, delta) => {
    if (!cloudRef.current) return;
    if (active && !started.current) { started.current = true; complete.current = false; }
    const target = 1;
    cloudRef.current.children.forEach((cloud, index) => {
      const item = clouds[index];
      const current = cloud.userData.reveal ?? 0;
      const next = THREE.MathUtils.damp(current, target, active ? 1.45 : 3, delta);
      cloud.userData.reveal = next;
      cloud.position.set(item.position[0] + item.direction.x * next, item.position[1] + item.direction.y * next, item.position[2] + item.direction.z * next);
      cloud.rotation.y += delta * .02 * (index % 2 ? 1 : -1);
    });
    if (active && !complete.current && cloudRef.current.children.length && (cloudRef.current.children[0].userData.reveal ?? 0) > .98) { complete.current = true; onComplete(); }
  });

  return <group ref={cloudRef}>{clouds.map((cloud, index) => <group key={index} position={cloud.position}><mesh scale={[1.2 + (index % 3) * .4, .42, .8]}><sphereGeometry args={[1, 10, 6]} /><meshBasicMaterial color="#f5f0df" transparent opacity={.84} depthWrite={false} /></mesh><mesh position={[.8, .08, .12]} scale={[.8, .35, .65]}><sphereGeometry args={[1, 10, 6]} /><meshBasicMaterial color="#fffaf0" transparent opacity={.8} depthWrite={false} /></mesh></group>)}</group>;
}

function Tree({ position, scale = 1 }: { position: Point3; scale?: number }) {
  return <group position={position} scale={scale}><mesh position={[0, .42, 0]} castShadow><cylinderGeometry args={[.08, .13, .85, 6]} /><meshStandardMaterial color="#694633" flatShading /></mesh><mesh position={[0, 1.05, 0]} castShadow><coneGeometry args={[.55, 1.35, 7]} /><meshStandardMaterial color="#2b684d" flatShading /></mesh><mesh position={[.14, 1.42, -.04]} castShadow><coneGeometry args={[.36, .9, 7]} /><meshStandardMaterial color="#3d8058" flatShading /></mesh></group>;
}

function IslandTerrain({ quality }: { quality: QualityTier }) {
  const shape = useMemo(() => { const s = new THREE.Shape(); s.moveTo(-6.8, -1.2); s.bezierCurveTo(-7.5, -4.2, -3.6, -5.5, 0, -5.1); s.bezierCurveTo(4.5, -5.6, 7.5, -3.3, 6.9, .2); s.bezierCurveTo(7.5, 3.7, 4.4, 5.4, .2, 5.2); s.bezierCurveTo(-4.4, 5.6, -7.1, 3.7, -6.8, -1.2); return new THREE.ExtrudeGeometry(s, { depth: .55, bevelEnabled: true, bevelSegments: 2, bevelSize: .15, bevelThickness: .16 }); }, []);
  const path = useMemo(() => new THREE.CatmullRomCurve3([new THREE.Vector3(-5.8, .05, 3.2), new THREE.Vector3(-3.2, .05, 1.4), new THREE.Vector3(-1.2, .05, .7), new THREE.Vector3(0, .05, -2.1), new THREE.Vector3(3.1, .05, -2.8)]), []);
  const trees = useMemo(() => [...foliageLocations, ...foliageLocations.slice(0, Math.max(0, QUALITY_PRESETS[quality].foliage / 40))].map((location, index) => [location, 0.75 + (index % 4) * .12] as const), [quality]);
  return <group>
    <mesh geometry={shape} rotation-x={-Math.PI / 2} position={[0, -.15, 0]} receiveShadow castShadow><meshStandardMaterial color="#29564a" roughness={1} flatShading /></mesh>
    <mesh position={[0, .06, 0]} scale={[1, .82, .92]} rotation-x={-Math.PI / 2} receiveShadow><circleGeometry args={[6.7, 64]} /><meshStandardMaterial color="#4e8a59" roughness={1} /></mesh>
    <mesh position={[0, -.42, 0]}><cylinderGeometry args={[7.4, 7.8, .22, 48]} /><meshStandardMaterial color="#b88b5a" roughness={1} /></mesh>
    <mesh position={[0, -.67, 0]}><cylinderGeometry args={[8.2, 8.4, .18, 48]} /><meshStandardMaterial color="#4e9ca0" roughness={.55} metalness={.05} /></mesh>
    <mesh position={[0, .11, 0]}><tubeGeometry args={[path, 72, .2, 8, false]} /><meshStandardMaterial color="#d5b678" roughness={1} /></mesh>
    {trees.map(([location, scale], index) => <Tree key={index} position={location} scale={scale} />)}
    <mesh position={[-4.8, .12, -1.7]} rotation-x={-Math.PI / 2}><circleGeometry args={[.7, 16]} /><meshStandardMaterial color="#8bc4b7" transparent opacity={.65} /></mesh>
    <mesh position={[4.8, .12, 1.9]} rotation-x={-Math.PI / 2}><circleGeometry args={[.95, 16]} /><meshStandardMaterial color="#8bc4b7" transparent opacity={.65} /></mesh>
  </group>;
}

function HallOfFame({ hovered, onHover, onClick }: { hovered: boolean; onHover: (value: boolean) => void; onClick: (event: any) => void }) {
  return <group position={[0, 0, -2.2]} onPointerOver={(event) => { event.stopPropagation(); onHover(true); }} onPointerOut={() => onHover(false)} onClick={onClick}>
    <mesh position={[0, 1.1, 0]} castShadow><boxGeometry args={[3.4, 2.15, 1.8]} /><meshStandardMaterial color={hovered ? '#b9523f' : '#713a35'} roughness={.78} /></mesh>
    <mesh position={[0, 2.42, 0]} castShadow><coneGeometry args={[2.65, 1.15, 4]} /><meshStandardMaterial color="#2b3549" roughness={.7} /></mesh>
    <mesh position={[0, 1.15, -.93]}><boxGeometry args={[1.05, 1.75, .08]} /><meshStandardMaterial color="#16212c" emissive={hovered ? '#e8c464' : '#000000'} emissiveIntensity={hovered ? 1.2 : 0} /></mesh>
    {[-1.28, 1.28].map((x) => <mesh key={x} position={[x, 1.3, -.98]} castShadow><cylinderGeometry args={[.16, .2, 2.35, 8]} /><meshStandardMaterial color="#e8c464" metalness={.35} roughness={.5} /></mesh>)}
    <mesh position={[0, 2.15, -1]}><boxGeometry args={[2.1, .35, .08]} /><meshStandardMaterial color="#e8c464" emissive="#5a3915" emissiveIntensity={.5} /></mesh>
    <mesh position={[0, .06, -1.25]} rotation-x={-Math.PI / 2}><circleGeometry args={[2.1, 32]} /><meshStandardMaterial color="#614a3e" roughness={1} /></mesh>
  </group>;
}

function ArthurSprite({ atlasUrl, moving }: { atlasUrl: string; moving: boolean }) {
  const loaded = useLoader(THREE.TextureLoader, atlasUrl);
  const texture = useMemo(() => loaded.clone(), [loaded]);
  const elapsed = useRef(0);
  useEffect(() => { texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.wrapS = THREE.ClampToEdgeWrapping; texture.repeat.set(.25, 1); texture.needsUpdate = true; return () => texture.dispose(); }, [texture]);
  useFrame((_, delta) => { elapsed.current += delta; const frame = moving ? Math.floor(elapsed.current * 6) % 4 : 1; texture.offset.x = frame * .25; });
  return <><mesh position={[0, .03, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[.35, 20]} /><meshBasicMaterial color="#07111c" transparent opacity={.38} depthWrite={false} /></mesh><sprite position={[0, 1.15, 0]} scale={[1.15, 1.84, 1]}><spriteMaterial map={texture} transparent alphaTest={.03} depthWrite={false} /></sprite></>;
}

function PlayerController({ phase, atlasUrl, initialPosition, destinationRequest, hallRequest, playerRef, onHall, onPosition }: { phase: WorldPhase; atlasUrl: string; initialPosition: Point3; destinationRequest: Point3 | null; hallRequest: number; playerRef: React.MutableRefObject<THREE.Group | null>; onHall: () => void; onPosition: (position: Point3) => void }) {
  const destination = useRef<THREE.Vector3 | null>(null);
  const position = useRef(new THREE.Vector3(...initialPosition));
  const keys = useRef(new Set<string>());
  const moving = useRef(false);
  const hallSent = useRef(Math.hypot(initialPosition[0], initialPosition[2] + 2.2) < 1.1);
  useEffect(() => { const down = (event: KeyboardEvent) => { if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(event.key.toLowerCase())) keys.current.add(event.key.toLowerCase()); }; const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase()); window.addEventListener('keydown', down); window.addEventListener('keyup', up); return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); }; }, []);
  useEffect(() => { if (hallRequest > 0) { destination.current = new THREE.Vector3(0, .08, -2.2); hallSent.current = false; } }, [hallRequest]);
  useEffect(() => { if (destinationRequest) destination.current = new THREE.Vector3(...destinationRequest); }, [destinationRequest]);
  useFrame((_, delta) => {
    if (!playerRef.current || phase !== 'exploring') { if (playerRef.current) playerRef.current.position.copy(position.current); return; }
    const direction = new THREE.Vector3();
    if (keys.current.has('a') || keys.current.has('arrowleft')) direction.x -= 1;
    if (keys.current.has('d') || keys.current.has('arrowright')) direction.x += 1;
    if (keys.current.has('w') || keys.current.has('arrowup')) direction.z -= 1;
    if (keys.current.has('s') || keys.current.has('arrowdown')) direction.z += 1;
    if (direction.lengthSq()) { direction.normalize(); destination.current = null; position.current.addScaledVector(direction, delta * 3.2); moving.current = true; }
    else if (destination.current) { const deltaPosition = destination.current.clone().sub(position.current); deltaPosition.y = 0; if (deltaPosition.length() < .08) { destination.current = null; moving.current = false; } else { deltaPosition.normalize(); position.current.addScaledVector(deltaPosition, Math.min(delta * 2.6, deltaPosition.length())); moving.current = true; } }
    else moving.current = false;
    position.current.x = clamp(position.current.x, -5.8, 5.8); position.current.z = clamp(position.current.z, -4.2, 4.2); position.current.y = .08; playerRef.current.position.copy(position.current);
    if (Math.hypot(position.current.x, position.current.z + 2.2) < 1.1 && destination.current == null && !hallSent.current) { hallSent.current = true; onHall(); }
    onPosition([position.current.x, position.current.y, position.current.z]);
  });
  return <group ref={playerRef}><ArthurSprite atlasUrl={atlasUrl} moving={moving.current} /></group>;
}

function CameraRig({ phase, playerRef }: { phase: WorldPhase; playerRef: React.MutableRefObject<THREE.Group | null> }) {
  const { camera } = useThree();
  useFrame((_, delta) => {
    let targetPosition = new THREE.Vector3(0, 10.5, 14.5); let lookAt = new THREE.Vector3(0, 0, 0);
    if (phase === 'camera-descent') { targetPosition = new THREE.Vector3(0, 4.3, 7.5); lookAt = new THREE.Vector3(0, 0, 0); }
    if (phase === 'exploring' || phase === 'hall-confirm') { const p = playerRef.current?.position || new THREE.Vector3(0, 0, 4.5); targetPosition = new THREE.Vector3(p.x + 4.6, 7.8, p.z + 8.4); lookAt = new THREE.Vector3(p.x, .15, p.z); }
    if (phase === 'hall-transition') { targetPosition = new THREE.Vector3(0, 2.4, 1.8); lookAt = new THREE.Vector3(0, 1, -2); }
    camera.position.lerp(targetPosition, 1 - Math.pow(.001, delta)); camera.lookAt(lookAt);
  });
  return null;
}

export function IslandScene({ phase, quality, atlasUrl, position, onRevealComplete, onHall, onPosition }: SceneProps) {
  const playerRef = useRef<THREE.Group | null>(null);
  const [hallRequest, setHallRequest] = useState(0);
  const [destinationRequest, setDestinationRequest] = useState<Point3 | null>(null);
  const [hallHovered, setHallHovered] = useState(false);
  const preset = QUALITY_PRESETS[quality];
  return <>
    <color attach="background" args={['#7dc9c8']} />
    <ambientLight intensity={1.2} color="#f9ead0" />
    <directionalLight castShadow intensity={2.4} position={[-6, 12, 7]} color="#fff0cf" shadow-mapSize={[preset.shadowMap, preset.shadowMap]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
    <mesh position={[0, -.82, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[34, 64]} /><meshStandardMaterial color="#63b9ba" roughness={.6} metalness={.05} /></mesh>
    <IslandTerrain quality={quality} />
    <HallOfFame hovered={hallHovered} onHover={setHallHovered} onClick={(event) => { event.stopPropagation(); setHallRequest((value) => value + 1); }} />
    {phase !== 'exploring' && phase !== 'hall-confirm' && phase !== 'hall-transition' && <CloudLayer active={phase === 'cloud-reveal'} count={preset.clouds} onComplete={onRevealComplete} />}
    <mesh position={[0, .12, 0]} rotation-x={-Math.PI / 2} onPointerDown={(event) => { event.stopPropagation(); const point = event.point; setDestinationRequest([clamp(point.x, -5.4, 5.4), .08, clamp(point.z, -4, 4)]); }}><planeGeometry args={[13.5, 10]} /><meshBasicMaterial transparent opacity={0} /></mesh>
    <PlayerController phase={phase} atlasUrl={atlasUrl} initialPosition={position} destinationRequest={destinationRequest} hallRequest={hallRequest} playerRef={playerRef} onHall={onHall} onPosition={onPosition} />
    <CameraRig phase={phase} playerRef={playerRef} />
  </>;
}
