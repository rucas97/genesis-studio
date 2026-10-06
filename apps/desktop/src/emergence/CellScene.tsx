import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type EmergencePhase = 'idle' | 'year0' | 'year5' | 'year10' | 'critical';

export interface CellSceneProps {
  phase: EmergencePhase;
}

// Membrane color shifts with phase.
function membraneColor(phase: EmergencePhase): number {
  switch (phase) {
    case 'idle':     return 0xd4a373;   // warm baseline (textbook orange)
    case 'year0':    return 0xd4a373;
    case 'year5':    return 0xc89070;   // slightly stressed
    case 'year10':   return 0xa8655c;   // reddish
    case 'critical': return 0x8a3a3a;   // deep red
  }
}

function accentColor(phase: EmergencePhase): number {
  switch (phase) {
    case 'idle':     return 0x66ccff;
    case 'year0':    return 0x66ccff;
    case 'year5':    return 0x88dd88;
    case 'year10':   return 0xffaa66;
    case 'critical': return 0xff4444;
  }
}

export function CellScene({ phase }: CellSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 4, 62], fov: 42, near: 0.5, far: 500 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
        preserveDrawingBuffer: false,
      }}
      style={{ background: '#07090c' }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#07090c']} />
      <fog attach="fog" args={['#07090c', 90, 200]} />

      {/* Three-point lighting + rim */}
      <hemisphereLight args={[0xbcd0ff, 0x1a0e2a, 0.55]} />
      <directionalLight position={[35, 45, 35]} intensity={1.35} color={0xfff0d8} />
      <directionalLight position={[-30, -20, -25]} intensity={0.45} color={0x88aaff} />
      <directionalLight position={[0, 0, -40]} intensity={0.35} color={0xffaa66} />
      <pointLight position={[0, 0, 30]} intensity={0.6} color={0xffddaa} distance={80} />

      {/* Outer membrane is static — the cut always faces the camera. */}
      <CutawayMembrane phase={phase} />

      {/* Interior rotates slowly inside the fixed shell. */}
      <SlowRotate speed={phase === 'idle' ? 0.04 : 0.11}>
        <Nucleus phase={phase} />
        <RoughEndoplasmicReticulum phase={phase} />
        <SmoothEndoplasmicReticulum phase={phase} />
        <Golgi phase={phase} />
        <Mitochondria phase={phase} />
        <Chloroplasts phase={phase} />
        <Ribosomes phase={phase} />
        {phase !== 'idle' && <ExtracellularSignals phase={phase} />}
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

// ===========================================================================
// Cutaway membrane
// ===========================================================================
//
// A sphere with a 90-degree wedge removed from the front quadrant
// (phi from pi/4 to 3pi/4), so the camera at +Z looks straight through
// the opening into the cell interior.
//
// Two concentric shells suggest membrane thickness. Two meridian tubes
// trace the cut edge and give it a visible rim.

function CutawayMembrane({ phase }: { phase: EmergencePhase }) {
  const color = membraneColor(phase);
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    // Gentle breathing.
    const s = 1 + Math.sin(t * 0.9) * 0.008;
    ref.current.scale.setScalar(s);
  });

  const PHI_START = 0.75 * Math.PI;   // start at 135°
  const PHI_LEN = 1.5 * Math.PI;      // sweep 270°, leaving a 90° gap facing +Z

  return (
    <group ref={ref}>
      {/* Outer shell — translucent warm membrane */}
      <mesh>
        <sphereGeometry args={[22, 128, 96, PHI_START, PHI_LEN]} />
        <meshPhysicalMaterial
          color={color}
          transparent
          opacity={0.20}
          roughness={0.65}
          metalness={0.05}
          transmission={0.85}
          thickness={1.4}
          side={THREE.DoubleSide}
          emissive={color}
          emissiveIntensity={0.10}
          clearcoat={0.4}
        />
      </mesh>

      {/* Inner shell — slightly smaller, adds depth to the wall */}
      <mesh>
        <sphereGeometry args={[21.2, 96, 64, PHI_START, PHI_LEN]} />
        <meshPhysicalMaterial
          color={color}
          transparent
          opacity={0.12}
          roughness={0.8}
          transmission={0.9}
          side={THREE.BackSide}
          emissive={color}
          emissiveIntensity={0.06}
        />
      </mesh>

      {/* Rim meridians — the visible "cut" edges */}
      <RimMeridian phi={PHI_START} color={color} />
      <RimMeridian phi={PHI_START + PHI_LEN} color={color} />

      {/* Faint equatorial ring near the opening for the "shell thickness" feel */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[21.7, 0.05, 8, 128]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function RimMeridian({ phi, color }: { phi: number; color: number }) {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const r = 21.6;
    for (let i = 0; i <= 96; i++) {
      const theta = (i / 96) * Math.PI;
      const x = r * Math.sin(theta) * Math.cos(phi);
      const y = r * Math.cos(theta);
      const z = r * Math.sin(theta) * Math.sin(phi);
      points.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 140, 0.22, 10, false);
  }, [phi]);

  return (
    <mesh geometry={geometry} raycast={() => null}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        roughness={0.5}
        metalness={0.15}
      />
    </mesh>
  );
}

// ===========================================================================
// Nucleus + nucleolus + nuclear pores
// ===========================================================================

function Nucleus({ phase }: { phase: EmergencePhase }) {
  const stressed = phase === 'year10' || phase === 'critical';
  const envelopeColor = stressed ? 0xff5577 : 0xe89bb8;   // pink/red outer
  const nucleolusColor = 0xd83a3a;                        // deep red nucleolus
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const s = 1 + Math.sin(t * 0.6) * 0.02;
    ref.current.scale.setScalar(s);
  });

  const pores = useMemo(() => {
    // Fibonacci sphere distribution of 40 pores on radius 6.1
    const arr: [number, number, number][] = [];
    const n = 40;
    const golden = Math.PI * (1 + Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = golden * i;
      arr.push([
        6.15 * Math.cos(theta) * radius,
        6.15 * y,
        6.15 * Math.sin(theta) * radius,
      ]);
    }
    return arr;
  }, []);

  return (
    <group position={[-2, 0, -1]}>
      {/* Nuclear envelope */}
      <mesh ref={ref}>
        <sphereGeometry args={[6, 64, 64]} />
        <meshPhysicalMaterial
          color={envelopeColor}
          roughness={0.55}
          metalness={0.05}
          transmission={0.35}
          thickness={1.2}
          emissive={envelopeColor}
          emissiveIntensity={0.14}
        />
      </mesh>

      {/* Wireframe highlight to suggest the envelope is a distinct layer */}
      <mesh>
        <sphereGeometry args={[6.05, 32, 32]} />
        <meshBasicMaterial color={envelopeColor} wireframe transparent opacity={0.08} />
      </mesh>

      {/* Nucleolus inside */}
      <mesh position={[1.2, -0.9, 0.6]}>
        <sphereGeometry args={[2.1, 40, 40]} />
        <meshStandardMaterial
          color={nucleolusColor}
          roughness={0.55}
          emissive={nucleolusColor}
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[1.2, -0.9, 0.6]}>
        <sphereGeometry args={[2.12, 20, 20]} />
        <meshBasicMaterial color={nucleolusColor} wireframe transparent opacity={0.2} />
      </mesh>

      {/* Nuclear pores */}
      {pores.map((p, i) => (
        <mesh key={i} position={p} raycast={() => null}>
          <sphereGeometry args={[0.24, 10, 10]} />
          <meshBasicMaterial color={0x88bbff} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ===========================================================================
// Rough endoplasmic reticulum — folded sheets dotted with ribosomes
// ===========================================================================

function RoughEndoplasmicReticulum({ phase }: { phase: EmergencePhase }) {
  const stressed = phase === 'year10' || phase === 'critical';
  const bodyColor = stressed ? 0xff8866 : 0xef7a9a;
  const riboColor = 0x8a5a3a;

  const sheets = useMemo(() => {
    const arr: THREE.CatmullRomCurve3[] = [];
    // 5 concentric folded sheets wrapping the right side of the nucleus
    for (let s = 0; s < 5; s++) {
      const pts: THREE.Vector3[] = [];
      const steps = 18;
      const baseR = 8.6 + s * 0.7;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        // Fold from top-front around to bottom-back
        const angle = -0.4 + t * 1.9;
        const wobble = Math.sin(t * Math.PI * 4 + s) * 0.35;
        const r = baseR + wobble;
        pts.push(new THREE.Vector3(
          2 + Math.cos(angle) * r * 0.55,
          -3.5 + t * 7 + Math.sin(t * Math.PI * 3 + s) * 0.4,
          -1 + Math.sin(angle) * r * 0.55,
        ));
      }
      arr.push(new THREE.CatmullRomCurve3(pts));
    }
    return arr;
  }, []);

  const ribosomeDots = useMemo(() => {
    const arr: [number, number, number][] = [];
    const n = 60;
    for (let i = 0; i < n; i++) {
      const s = i % 5;
      const t = ((i * 7) % 100) / 100;
      const angle = -0.4 + t * 1.9;
      const r = 8.6 + s * 0.7 + Math.sin(t * Math.PI * 4 + s) * 0.35;
      const jitter = 0.4;
      arr.push([
        2 + Math.cos(angle) * r * 0.55 + (Math.random() - 0.5) * jitter,
        -3.5 + t * 7 + Math.sin(t * Math.PI * 3 + s) * 0.4 + (Math.random() - 0.5) * jitter,
        -1 + Math.sin(angle) * r * 0.55 + (Math.random() - 0.5) * jitter,
      ]);
    }
    return arr;
  }, []);

  return (
    <group>
      {sheets.map((curve, i) => {
        const geo = new THREE.TubeGeometry(curve, 120, 0.35, 12, false);
        return (
          <mesh key={i} geometry={geo}>
            <meshStandardMaterial
              color={bodyColor}
              roughness={0.5}
              metalness={0.05}
              emissive={bodyColor}
              emissiveIntensity={0.2}
            />
          </mesh>
        );
      })}
      {ribosomeDots.map((p, i) => (
        <mesh key={i} position={p} raycast={() => null}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial
            color={riboColor}
            roughness={0.7}
            emissive={riboColor}
            emissiveIntensity={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

// ===========================================================================
// Smooth endoplasmic reticulum — plain tubules, no ribosomes
// ===========================================================================

function SmoothEndoplasmicReticulum({ phase }: { phase: EmergencePhase }) {
  const stressed = phase === 'year10' || phase === 'critical';
  const color = stressed ? 0xff9966 : 0xf2a3b8;

  const curves = useMemo(() => {
    const arr: THREE.CatmullRomCurve3[] = [];
    for (let s = 0; s < 4; s++) {
      const pts: THREE.Vector3[] = [];
      const steps = 16;
      const rBase = 5.5 + s * 0.9;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const angle = 2.6 + t * 1.8;
        const r = rBase + Math.sin(t * Math.PI * 3 + s * 1.2) * 0.4;
        pts.push(new THREE.Vector3(
          -4 + Math.cos(angle) * r,
          -4 + t * 8,
          -4 + Math.sin(angle) * r,
        ));
      }
      arr.push(new THREE.CatmullRomCurve3(pts));
    }
    return arr;
  }, []);

  return (
    <group>
      {curves.map((c, i) => {
        const geo = new THREE.TubeGeometry(c, 100, 0.28, 10, false);
        return (
          <mesh key={i} geometry={geo}>
            <meshStandardMaterial
              color={color}
              roughness={0.45}
              emissive={color}
              emissiveIntensity={0.2}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ===========================================================================
// Golgi apparatus — stacked flattened sacs (pink/magenta like the reference)
// ===========================================================================

function Golgi({ phase }: { phase: EmergencePhase }) {
  const stressed = phase === 'year10' || phase === 'critical';
  const color = stressed ? 0xff7799 : 0xd44a8a;

  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.z = -0.25 + Math.sin(t * 0.4) * 0.04;
  });

  return (
    <group position={[-12, -7, 3]} rotation={[0.35, 0.8, -0.25]}>
      <group ref={ref}>
        {/* 6 stacked, curved flattened sacs of decreasing radius */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const r = 2.6 - i * 0.16;
          const y = i * 0.55 - 1.4;
          return (
            <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[r, 0.22, 12, 64, Math.PI * 1.5]} />
              <meshPhysicalMaterial
                color={color}
                roughness={0.4}
                metalness={0.1}
                transmission={0.35}
                thickness={0.6}
                emissive={color}
                emissiveIntensity={0.25}
                clearcoat={0.5}
              />
            </mesh>
          );
        })}
        {/* Small vesicles budding off the top */}
        {[[-2.2, 2.4, 0.8], [2.0, 2.6, -0.6], [0.4, 2.9, 1.0]].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]}>
            <sphereGeometry args={[0.35, 14, 14]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.3}
              roughness={0.5}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ===========================================================================
// Mitochondria — capsules with cristae
// ===========================================================================

function Mitochondria({ phase }: { phase: EmergencePhase }) {
  const stressed = phase === 'year10' || phase === 'critical';
  const shell = stressed ? 0xff6a55 : 0x5a9ad8;   // blue like the reference
  const cristae = stressed ? 0xffaa66 : 0x88c8ff;

  const items = useMemo(() => {
    const positions: Array<{
      key: number;
      pos: [number, number, number];
      rot: [number, number, number];
      scale: number;
    }> = [
      { key: 0, pos: [-16, 6, 0],    rot: [0.3, 1.2, 0.2],  scale: 1.0 },
      { key: 1, pos: [13, -6, 3],    rot: [0.4, 0.6, -0.3], scale: 0.95 },
      { key: 2, pos: [8, 10, -4],    rot: [0.2, 2.1, 0.5],  scale: 0.9 },
      { key: 3, pos: [-10, 11, -2],  rot: [0.5, 0.9, 0.3],  scale: 1.05 },
      { key: 4, pos: [15, 6, 6],     rot: [0.3, 1.7, -0.2], scale: 0.95 },
    ];
    if (phase === 'year5' || phase === 'year10' || phase === 'critical') {
      positions.push({ key: 5, pos: [-7, -12, 4], rot: [0.6, 0.4, 0.5], scale: 0.85 });
    }
    return positions;
  }, [phase]);

  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const it = items[i];
      if (!it) return;
      const bob = Math.sin(t * 0.55 + i * 1.4) * 0.35;
      child.position.set(it.pos[0], it.pos[1] + bob, it.pos[2]);
    });
  });

  return (
    <group ref={groupRef}>
      {items.map((m) => (
        <group key={m.key} position={m.pos} rotation={m.rot} scale={m.scale}>
          {/* Outer shell */}
          <mesh>
            <capsuleGeometry args={[1.1, 2.6, 12, 24]} />
            <meshPhysicalMaterial
              color={shell}
              roughness={0.42}
              metalness={0.15}
              transmission={0.3}
              thickness={1.0}
              emissive={shell}
              emissiveIntensity={0.28}
              clearcoat={0.4}
            />
          </mesh>
          {/* Inner matrix */}
          <mesh>
            <capsuleGeometry args={[0.75, 2.4, 8, 20]} />
            <meshStandardMaterial
              color={cristae}
              roughness={0.5}
              emissive={cristae}
              emissiveIntensity={0.45}
            />
          </mesh>
          {/* Cristae — stacked folded discs */}
          {[-0.9, -0.45, 0, 0.45, 0.9].map((z, i) => (
            <mesh key={i} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.85, 0.09, 8, 28]} />
              <meshStandardMaterial
                color={0xffe0a0}
                emissive={0xffc060}
                emissiveIntensity={0.6}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ===========================================================================
// Chloroplasts — green with thylakoid stacks
// ===========================================================================

function Chloroplasts({ phase }: { phase: EmergencePhase }) {
  const stressed = phase === 'critical';
  const shell = stressed ? 0x8ab84a : 0x4aa84a;
  const thylakoid = 0x2a7a2a;

  const items = useMemo(() => {
    const positions: Array<{
      key: number;
      pos: [number, number, number];
      rot: [number, number, number];
      scale: number;
    }> = [
      { key: 0, pos: [-14, -5, -5], rot: [0.2, 1.1, 0.4],  scale: 1.0 },
      { key: 1, pos: [11, 2, -7],   rot: [0.5, 0.4, -0.2], scale: 0.9 },
      { key: 2, pos: [6, -13, 2],   rot: [0.3, 2.3, 0.3],  scale: 0.95 },
    ];
    return positions;
  }, []);

  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const it = items[i];
      if (!it) return;
      const bob = Math.sin(t * 0.5 + i * 1.7) * 0.4;
      child.position.set(it.pos[0], it.pos[1] + bob, it.pos[2]);
    });
  });

  return (
    <group ref={groupRef}>
      {items.map((c) => (
        <group key={c.key} position={c.pos} rotation={c.rot} scale={c.scale}>
          {/* Lens-shaped shell */}
          <mesh scale={[1, 1, 0.55]}>
            <sphereGeometry args={[2.4, 32, 32]} />
            <meshPhysicalMaterial
              color={shell}
              roughness={0.45}
              metalness={0.1}
              transmission={0.4}
              thickness={1.2}
              emissive={shell}
              emissiveIntensity={0.25}
              clearcoat={0.5}
            />
          </mesh>
          {/* Thylakoid grana — stacks of discs */}
          {[-1.2, -0.4, 0.4, 1.2].map((x, i) => (
            <group key={i} position={[x, 0, 0]}>
              {[-0.3, -0.1, 0.1, 0.3].map((y, j) => (
                <mesh key={j} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.55, 0.55, 0.05, 20]} />
                  <meshStandardMaterial
                    color={thylakoid}
                    emissive={thylakoid}
                    emissiveIntensity={0.4}
                    roughness={0.5}
                  />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

// ===========================================================================
// Ribosomes — free-floating dots in the cytoplasm
// ===========================================================================

function Ribosomes({ phase }: { phase: EmergencePhase }) {
  const count = useMemo(() => {
    switch (phase) {
      case 'idle':     return 55;
      case 'year0':    return 65;
      case 'year5':    return 85;
      case 'year10':   return 100;
      case 'critical': return 110;
    }
  }, [phase]);

  const items = useMemo(() => {
    const arr: [number, number, number][] = [];
    // Sample inside the cytoplasm shell (radius 7 to 19) avoiding the nucleus
    let attempts = 0;
    while (arr.length < count && attempts < count * 10) {
      attempts++;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 8 + Math.random() * 10;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);
      // Skip if inside nucleus region
      const dx = x - (-2), dy = y - 0, dz = z - (-1);
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 7) continue;
      arr.push([x, y, z]);
    }
    return arr;
  }, [count]);

  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.children.forEach((child, i) => {
      const base = items[i];
      if (!base) return;
      child.position.y = base[1] + Math.sin(t * 1.2 + i * 0.7) * 0.08;
    });
  });

  return (
    <group ref={ref}>
      {items.map((p, i) => (
        <mesh key={i} position={p} raycast={() => null}>
          <sphereGeometry args={[0.18, 8, 8]} />
          <meshStandardMaterial
            color={0xb06a3a}
            roughness={0.75}
            emissive={0xb06a3a}
            emissiveIntensity={0.15}
          />
        </mesh>
      ))}
    </group>
  );
}

// ===========================================================================
// Extracellular signals — appear from year 0 onward
// ===========================================================================

function ExtracellularSignals({ phase }: { phase: EmergencePhase }) {
  const count = phase === 'critical' ? 44 : phase === 'year10' ? 30 : 18;

  const items = useMemo(() => {
    const arr: Array<{ key: number; base: [number, number, number]; offset: number }> = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 28 + ((i * 5) % 3) * 2;
      const y = (((i * 3) % 7) - 3) * 3;
      arr.push({
        key: i,
        base: [Math.cos(a) * r, y, Math.sin(a) * r],
        offset: i * 0.9,
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
      const pulse = 0.6 + Math.sin(t * 2 + it.offset) * 0.4;
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = pulse;
    });
  });

  const color = phase === 'critical' ? 0xffaaaa : 0x88bbff;
  const emissive = phase === 'critical' ? 0xff4444 : accentColor(phase);

  return (
    <group ref={ref}>
      {items.map((it) => (
        <mesh key={it.key} position={it.base} raycast={() => null}>
          <sphereGeometry args={[0.55, 12, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={0.75}
          />
        </mesh>
      ))}
    </group>
  );
}

// ===========================================================================
// Tumor cluster — forms at year10 and pulses red at critical
// ===========================================================================

function TumorCluster({ critical = false }: { critical?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const items = useMemo(() => {
    const arr: Array<{ key: number; base: [number, number, number]; offset: number }> = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const r = 4 + ((i * 3) % 3) * 0.8;
      const y = (((i * 5) % 4) - 1.5) * 1.8;
      arr.push({
        key: i,
        base: [26 + Math.cos(a) * r, y, Math.sin(a) * r],
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
      const s = 1 + Math.sin(t * 2.5 + it.offset) * 0.18;
      child.scale.setScalar(s);
    });
  });

  const color = critical ? 0xff2222 : 0xff8844;
  return (
    <group ref={ref}>
      {items.map((it) => (
        <mesh key={it.key} position={it.base}>
          <sphereGeometry args={[1.7, 24, 24]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={critical ? 0.85 : 0.45}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}
