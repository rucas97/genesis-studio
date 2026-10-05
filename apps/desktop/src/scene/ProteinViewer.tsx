import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { fetchPDB, parsePDBCA, centerAtoms, type CAAtom } from './pdbLoader';

export function ProteinViewer({ pdbId }: { pdbId: string }) {
  const [atoms, setAtoms] = useState<CAAtom[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAtoms(null);
    setError(null);
    fetchPDB(pdbId)
      .then((text) => {
        if (cancelled) return;
        setAtoms(centerAtoms(parsePDBCA(text)));
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, [pdbId]);

  if (error) {
    return (
      <div className="placeholder">
        <div>Could not load {pdbId}.</div>
        <div>
          <code>{error}</code>
        </div>
        <div>
          RCSB is unreachable. Offline mode is not implemented yet — the next
          step is to bundle a local PDB file.
        </div>
      </div>
    );
  }

  if (!atoms) {
    return <div className="placeholder">Loading {pdbId}…</div>;
  }

  return (
    <Canvas
      camera={{ position: [0, 0, 90], fov: 45, near: 0.1, far: 1000 }}
      style={{ background: '#0a0a0a' }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 20, 20]} intensity={0.9} />
      <directionalLight position={[-20, -10, -20]} intensity={0.3} />
      <RotatingGroup>
        <ProteinMesh atoms={atoms} />
      </RotatingGroup>
    </Canvas>
  );
}

function RotatingGroup({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.3;
  });
  return <group ref={ref}>{children}</group>;
}

function ProteinMesh({ atoms }: { atoms: CAAtom[] }) {
  const line = useMemo(() => {
    const positions = new Float32Array(atoms.length * 3);
    atoms.forEach((a, i) => {
      positions[i * 3] = a.x;
      positions[i * 3 + 1] = a.y;
      positions[i * 3 + 2] = a.z;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: 0x66ccff });
    return new THREE.Line(geometry, material);
  }, [atoms]);

  return (
    <group>
      <primitive object={line} />
      {atoms.map((a, i) => (
        <mesh key={i} position={[a.x, a.y, a.z]}>
          <sphereGeometry args={[0.6, 8, 8]} />
          <meshStandardMaterial color={0x88aaff} />
        </mesh>
      ))}
    </group>
  );
}
