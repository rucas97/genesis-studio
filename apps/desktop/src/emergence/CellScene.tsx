import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type EmergencePhase = 'idle' | 'year0' | 'year5' | 'year10' | 'critical';

export interface CellSceneProps {
  phase: EmergencePhase;
}

export function CellScene({ phase }: CellSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 55], fov: 45 }}
      style={{ background: '#080c10' }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <color attach="background" args={['#080c10']} />
      <fog attach="fog" args={['#080c10', 60, 140]} />

      <hemisphereLight args={[0x88aaff, 0x110022, 0.7]} />
      <directionalLight position={[20, 30, 20]} intensity={1.1} />
      <directionalLight position={[-20, -10, -20]} intensity={0.4} color={0x88aaff} />

      <RotatingGroup speed={phase === 'idle' ? 0.08 : 0.25}>
        <CellMembrane phase={phase} />
        <Nucleus phase={phase} />
        <Organelles phase={phase} />
        <Extracellular phase={phase} />
        {phase === 'year10' && <TumorCluster />}
        {phase === 'critical' && <TumorCluster critical />}
      </RotatingGroup>
    </Canvas>
  );
}

function RotatingGroup({ children, speed }: { children: React.ReactNode; speed: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * speed; });
  return <group ref={ref}>{children}</group>;
}

function CellMembrane({ phase }: { phase: EmergencePhase }) {
  const color = phase === 'critical' ? 0x882222 : 0x224466;
  return (
    <mesh>
      <sphereGeometry args={[22, 48, 48]} />
      <meshPhysicalMaterial
        color={color}
        transparent
        opacity={0.15}
        roughness={0.8}
        transmission={0.9}
        thickness={2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Nucleus({ phase }: { phase: EmergencePhase }) {
  const color = phase === 'critical' ? 0x8844aa : 0x4455aa;
  return (
    <group>
      <mesh>
        <sphereGeometry args={[9, 32, 32]} />
        <meshStandardMaterial
          color={color}
          roughness={0.6}
          metalness={0.1}
          emissive={color}
          emissiveIntensity={0.15}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[9.05, 32, 32]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

function Organelles({ phase }: { phase: EmergencePhase }) {
  const count = phase === 'idle' ? 6 : phase === 'year0' ? 6 : phase === 'year5' ? 10 : 14;
  const items = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = 13 + (i % 3) * 1.2;
    const y = ((i % 5) - 2) * 3.2;
    items.push({ x: Math.cos(angle) * r, y, z: Math.sin(angle) * r, key: i });
  }
  return (
    <group>
      {items.map((it) => (
        <mesh key={it.key} position={[it.x, it.y, it.z]}>
          <sphereGeometry args={[1.2, 16, 16]} />
          <meshStandardMaterial
            color={phase === 'critical' ? 0xff6644 : 0x66cc88}
            roughness={0.5}
            emissive={phase === 'critical' ? 0xff4422 : 0x338855}
            emissiveIntensity={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

function Extracellular({ phase }: { phase: EmergencePhase }) {
  if (phase === 'idle') return null;
  const count = phase === 'critical' ? 20 : 8;
  const items = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = 30 + (i % 3) * 2;
    const y = ((i % 7) - 3) * 3;
    items.push({ x: Math.cos(angle) * r, y, z: Math.sin(angle) * r, key: i });
  }
  return (
    <group>
      {items.map((it) => (
        <mesh key={it.key} position={[it.x, it.y, it.z]}>
          <sphereGeometry args={[0.5, 12, 12]} />
          <meshStandardMaterial
            color={phase === 'critical' ? 0xffaaaa : 0x66aaff}
            emissive={phase === 'critical' ? 0xff4444 : 0x3366cc}
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}

function TumorCluster({ critical = false }: { critical?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
      ref.current.scale.setScalar(s);
    }
  });
  const items = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const r = 4 + (i % 3) * 0.8;
    const y = ((i % 4) - 1.5) * 1.6;
    items.push({ x: 12 + Math.cos(angle) * r, y, z: Math.sin(angle) * r, key: i });
  }
  const color = critical ? 0xff2222 : 0xff8844;
  return (
    <group ref={ref}>
      {items.map((it) => (
        <mesh key={it.key} position={[it.x, it.y, it.z]}>
          <sphereGeometry args={[1.6, 20, 20]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={critical ? 0.6 : 0.3}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}
