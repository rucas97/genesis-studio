import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { fetchPDB, parsePDBCA, centerAtoms, type CAAtom } from './pdbLoader';
import type { PickedResidue } from '../state/usePlaySession';

export interface ProteinViewerProps {
  pdbId: string;
  pickedResidueNumber: number | null;
  mutatedResidueNumber: number | null;
  onPickResidue: (picked: PickedResidue | null) => void;
}

export function ProteinViewer({
  pdbId, pickedResidueNumber, mutatedResidueNumber, onPickResidue,
}: ProteinViewerProps) {
  const [atoms, setAtoms] = useState<CAAtom[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAtoms(null);
    setError(null);
    fetchPDB(pdbId)
      .then((text) => { if (!cancelled) setAtoms(centerAtoms(parsePDBCA(text))); })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); });
    return () => { cancelled = true; };
  }, [pdbId]);

  if (error) {
    return (
      <div className="placeholder">
        <div>Could not load {pdbId}.</div>
        <div><code>{error}</code></div>
        <div>RCSB is unreachable. Offline bundling is the next step.</div>
      </div>
    );
  }

  if (!atoms) return <div className="placeholder">Loading {pdbId}…</div>;

  return (
    <Canvas
      camera={{ position: [0, 0, 90], fov: 45, near: 0.1, far: 1000 }}
      style={{ background: '#0a0a0a' }}
      onPointerMissed={() => onPickResidue(null)}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 20, 20]} intensity={0.9} />
      <directionalLight position={[-20, -10, -20]} intensity={0.3} />
      <RotatingGroup>
        <ProteinMesh
          atoms={atoms}
          pickedResidueNumber={pickedResidueNumber}
          mutatedResidueNumber={mutatedResidueNumber}
          onPickResidue={onPickResidue}
        />
      </RotatingGroup>
    </Canvas>
  );
}

function RotatingGroup({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 0.25; });
  return <group ref={ref}>{children}</group>;
}

function ProteinMesh({
  atoms, pickedResidueNumber, mutatedResidueNumber, onPickResidue,
}: {
  atoms: CAAtom[];
  pickedResidueNumber: number | null;
  mutatedResidueNumber: number | null;
  onPickResidue: (picked: PickedResidue | null) => void;
}) {
  const line = useMemo(() => {
    const positions = new Float32Array(atoms.length * 3);
    atoms.forEach((a, i) => {
      positions[i * 3] = a.x;
      positions[i * 3 + 1] = a.y;
      positions[i * 3 + 2] = a.z;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x334455 }));
  }, [atoms]);

  return (
    <group>
      <primitive object={line} />
      {atoms.map((a, i) => {
        const isPicked = a.residueNumber === pickedResidueNumber;
        const isMutated = a.residueNumber === mutatedResidueNumber;
        let color = 0x88aaff;
        let size = 0.55;
        if (isMutated) { color = 0xff6644; size = 1.1; }
        if (isPicked) { color = 0xffcc00; size = 1.3; }
        return (
          <mesh
            key={i}
            position={[a.x, a.y, a.z]}
            onClick={(e) => {
              e.stopPropagation();
              onPickResidue({
                index: i,
                residueNumber: a.residueNumber,
                residueOneLetter: a.residueOneLetter,
                atom: { x: a.x, y: a.y, z: a.z },
              });
            }}
          >
            <sphereGeometry args={[size, 12, 12]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}
