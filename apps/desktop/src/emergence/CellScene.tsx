import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type EmergencePhase = 'idle' | 'year0' | 'year5' | 'year10' | 'critical';

export interface CellSceneProps {
  phase: EmergencePhase;
}

export function CellScene({ phase }: CellSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 55], fov: 45, near: 0.5, far: 500 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      style={{ background: '#04060a' }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#04060a']} />
      <fog attach="fog" args={['#04060a', 60, 160]} />

      <hemisphereLight args={[0x88aaff, 0x110022, 0.7]} />
      <directionalLight position={[30, 40, 30]} intensity={1.2} />
      <directionalLight position={[-25, -15, -25]} intensity={0.4} color={0x88aaff} />
      <pointLight position={[0, 0, 0]} intensity={0.5} color={0x66ccff} distance={40} />

      <SlowRotate speed={phase === 'idle' ? 0.06 : 0.18}>
        <CellMembrane phase={phase} />
        <Nucleus phase={phase} />
        <Organelles phase={phase} />
        <Cytoskeleton phase={phase} />
        <ExtracellularSignals phase={phase} />
        {(phase === 'year10' || phase === 'critical') && (
          <TumorCluster critical={phase === 'critical'} />
        )}
      </SlowRotate>
    </Canvas>
  );
}

function SlowRotate({ children, speed }: { children: React.ReactNode; speed: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * speed; });
  return <group ref={ref}>{children}</group>;
}

function CellMembrane({ phase }: { phase: EmergencePhase }) {
  const color = phase === 'critical' ? 0x882222 : 0x224466;
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    // Breathe
    const s = 1 + Math.sin(t * 1.5) * 0.015;
    ref.current.scale.setScalar(s);
    // Flicker opacity
    const mat = ref.current.material as THREE.MeshPhysicalMaterial;
    mat.opacity = 0.12 + Math.sin(t * 2) * 0.03;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[22, 48, 48]} />
      <meshPhysicalMaterial
        color={color}
        transparent
        opacity={0.14}
        roughness={0.8}
        transmission={0.85}
        thickness={2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Nucleus({ phase }: { phase: EmergencePhase }) {
  const color = phase === 'critical' ? 0x8844aa : 0x4455aa;
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const s = 1 + Math.sin(t * 0.8) * 0.03;
    ref.current.scale.setScalar(s);
  });
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[9, 32, 32]} />
        <meshStandardMaterial
          color={color}
          roughness={0.6}
          metalness={0.1}
          emissive={color}
          emissiveIntensity={0.18}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[9.05, 32, 32]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.14} />
      </mesh>
    </group>
  );
}

function Organelles({ phase }: { phase: EmergencePhase }) {
  const count = phase === 'idle' ? 6 : phase === 'year0' ? 8 : phase === 'year5' ? 12 : 16;
  const items = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 13 + ((i * 7) % 3) * 1.2;
      const y = (((i * 3) % 5) - 2) * 3.2;
      arr.push({
        key: i,
        base: [Math.cos(angle) * r, y, Math.sin(angle) * r] as [number, number, number],
        speed: 0.4 + (i % 5) * 0.15,
        offset: (i * 1.7) % (Math.PI * 2),
      });
    }
    return arr;
  }, [count]);

  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const it = items[i];
      if (!it) return;
      const bob = Math.sin(t * it.speed + it.offset) * 0.7;
      child.position.set(it.base[0], it.base[1] + bob, it.base[2]);
    });
  });

  return (
    <group ref={groupRef}>
      {items.map((it) => (
        <mesh key={it.key} position={it.base}>
          <sphereGeometry args={[1.2, 18, 18]} />
          <meshStandardMaterial
            color={phase === 'critical' ? 0xff6644 : 0x66cc88}
            roughness={0.5}
            emissive={phase === 'critical' ? 0xff4422 : 0x338855}
            emissiveIntensity={0.35}
          />
        </mesh>
      ))}
    </group>
  );
}

function Cytoskeleton({ phase }: { phase: EmergencePhase }) {
  const segments = useMemo(() => {
    const arr: Array<{ from: [number, number, number]; to: [number, number, number] }> = [];
    const n = 24;
    for (let i = 0; i < n; i++) {
      const a1 = (i / n) * Math.PI * 2;
      const a2 = a1 + Math.PI * (0.6 + Math.random() * 0.5);
      const r = 18;
      const y1 = Math.sin(i * 1.3) * 8;
      const y2 = Math.cos(i * 0.9) * 8;
      arr.push({
        from: [Math.cos(a1) * r, y1, Math.sin(a1) * r],
        to: [Math.cos(a2) * r, y2, Math.sin(a2) * r],
      });
    }
    return arr;
  }, []);

  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.z += delta * 0.04;
  });

  return (
    <group ref={groupRef}>
      {segments.map((s, i) => {
        const geometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(...s.from),
          new THREE.Vector3(...s.to),
        ]);
        return (
          <primitive
            key={i}
            object={
              new THREE.Line(
                geometry,
                new THREE.LineBasicMaterial({
                  color: phase === 'critical' ? 0xaa4444 : 0x446688,
                  transparent: true,
                  opacity: 0.35,
                })
              )
            }
          />
        );
      })}
    </group>
  );
}

function ExtracellularSignals({ phase }: { phase: EmergencePhase }) {
  if (phase === 'idle') return null;
  const count = phase === 'critical' ? 28 : phase === 'year10' ? 18 : 10;
  const items = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 28 + ((i * 5) % 3) * 2;
      const y = (((i * 3) % 7) - 3) * 3;
      arr.push({
        key: i,
        base: [Math.cos(angle) * r, y, Math.sin(angle) * r] as [number, number, number],
        offset: (i * 0.9) % (Math.PI * 2),
      });
    }
    return arr;
  }, [count]);

  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.children.forEach((child, i) => {
      const it = items[i];
      if (!it) return;
      const pulse = 0.6 + Math.sin(t * 2 + it.offset) * 0.35;
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = pulse;
    });
  });

  return (
    <group ref={ref}>
      {items.map((it) => (
        <mesh key={it.key} position={it.base}>
          <sphereGeometry args={[0.5, 12, 12]} />
          <meshStandardMaterial
            color={phase === 'critical' ? 0xffaaaa : 0x66aaff}
            emissive={phase === 'critical' ? 0xff4444 : 0x3366cc}
            emissiveIntensity={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

function TumorCluster({ critical = false }: { critical?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const items = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 4 + ((i * 3) % 3) * 0.8;
      const y = (((i * 5) % 4) - 1.5) * 1.6;
      arr.push({
        key: i,
        base: [12 + Math.cos(a) * r, y, Math.sin(a) * r] as [number, number, number],
        offset: i * 0.4,
      });
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.children.forEach((child, i) => {
      const it = items[i];
      if (!it) return;
      const s = 1 + Math.sin(t * 2.5 + it.offset) * 0.15;
      child.scale.setScalar(s);
    });
  });

  const color = critical ? 0xff2222 : 0xff8844;
  return (
    <group ref={ref}>
      {items.map((it) => (
        <mesh key={it.key} position={it.base}>
          <sphereGeometry args={[1.6, 20, 20]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={critical ? 0.7 : 0.35}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}
