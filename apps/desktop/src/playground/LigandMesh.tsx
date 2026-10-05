import { useMemo } from 'react';
import * as THREE from 'three';
import {
  ELEMENT_COLORS, ELEMENT_RADII,
  type LigandEntry,
} from '../data/ligandLibrary';

export interface LigandMeshProps {
  ligand: LigandEntry;
  position?: [number, number, number];
  onAtomClick?: (atomIndex: number) => void;
  highlightedAtom?: number | null;
}

export function LigandMesh({
  ligand,
  position = [0, 0, 0],
  onAtomClick,
  highlightedAtom,
}: LigandMeshProps) {
  const bondLines = useMemo(() => {
    return ligand.bonds.map((bond, i) => {
      const a = ligand.atoms[bond.a];
      const b = ligand.atoms[bond.b];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([
        a.x, a.y, a.z, b.x, b.y, b.z,
      ], 3));
      return (
        <primitive
          key={i}
          object={new THREE.Line(
            g,
            new THREE.LineBasicMaterial({ color: 0x8899aa, transparent: true, opacity: 0.7 })
          )}
        />
      );
    });
  }, [ligand]);

  return (
    <group position={position}>
      {bondLines}
      {ligand.atoms.map((a, i) => {
        const color = ELEMENT_COLORS[a.element];
        const radius = ELEMENT_RADII[a.element];
        const isHighlighted = highlightedAtom === i;
        return (
          <mesh
            key={i}
            position={[a.x, a.y, a.z]}
            onClick={
              onAtomClick
                ? (e) => { e.stopPropagation(); onAtomClick(i); }
                : undefined
            }
          >
            <sphereGeometry args={[isHighlighted ? radius * 1.5 : radius, 16, 16]} />
            <meshStandardMaterial
              color={color}
              roughness={0.35}
              metalness={0.2}
              emissive={isHighlighted ? 0x66ccff : 0x000000}
              emissiveIntensity={isHighlighted ? 0.6 : 0}
            />
          </mesh>
        );
      })}
    </group>
  );
}
