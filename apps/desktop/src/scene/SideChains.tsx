import { useMemo } from 'react';
import * as THREE from 'three';
import type { CAAtom } from './pdbLoader';
import { getResidueColor } from './proteinColors';

export interface SideChainsProps {
  atoms: CAAtom[];
  pickedResidueNumber: number | null;
  mutatedResidueNumber: number | null;
  hoveredIndex: number | null;
}

export function SideChains({
  atoms, pickedResidueNumber, mutatedResidueNumber, hoveredIndex,
}: SideChainsProps) {
  const colors = useMemo(
    () => atoms.map((a) => new THREE.Color(getResidueColor(a.residueOneLetter))),
    [atoms]
  );

  const rendered = useMemo(() => {
    const set = new Set<number>();
    atoms.forEach((a, i) => {
      if (a.residueNumber === pickedResidueNumber ||
          a.residueNumber === mutatedResidueNumber ||
          i === hoveredIndex) set.add(i);
    });
    return Array.from(set);
  }, [atoms, pickedResidueNumber, mutatedResidueNumber, hoveredIndex]);

  return (
    <group>
      {rendered.map((i) => {
        const a = atoms[i];
        const isPicked = a.residueNumber === pickedResidueNumber;
        const isMutated = a.residueNumber === mutatedResidueNumber;
        const isHovered = i === hoveredIndex && !isPicked && !isMutated;
        let color = colors[i];
        let size = 0.6;
        let emissive = 0;
        if (isPicked) { color = new THREE.Color(0xffe066); size = 1.35; emissive = 0.8; }
        else if (isMutated) { color = new THREE.Color(0xff3a3a); size = 1.1; emissive = 0.6; }
        else if (isHovered) { color = colors[i].clone().offsetHSL(0, 0, 0.12); size = 0.85; emissive = 0.3; }
        return (
          <mesh key={i} position={[a.x, a.y, a.z]} raycast={() => null}>
            <sphereGeometry args={[size, 24, 24]} />
            <meshStandardMaterial
              color={color} roughness={0.32} metalness={0.2}
              emissive={color} emissiveIntensity={emissive}
            />
          </mesh>
        );
      })}
    </group>
  );
}
