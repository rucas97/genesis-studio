import { useMemo, useState } from 'react';
import * as THREE from 'three';
import type { CAAtom } from './pdbLoader';
import { getResidueColor } from './proteinColors';
import type { PickedResidue } from '../state/usePlaySession';

export interface SideChainsProps {
  atoms: CAAtom[];
  pickedResidueNumber: number | null;
  mutatedResidueNumber: number | null;
  draggingRef: React.MutableRefObject<boolean>;
  onPickResidue: (picked: PickedResidue | null) => void;
  onCut?: (atomIndex: number) => void;
  tool?: string;
}

/**
 * Only renders a visible sphere for hovered/picked/mutated residues.
 * All other CA positions get an invisible (opacity 0) sphere that still
 * participates in raycasting, so clicking anywhere on the backbone works.
 *
 * This is what makes the ribbon the visual focus instead of a chain of
 * spheres buried inside a tube.
 */
export function SideChains({
  atoms,
  pickedResidueNumber,
  mutatedResidueNumber,
  draggingRef,
  onPickResidue,
  onCut,
  tool = 'select',
}: SideChainsProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const colors = useMemo(
    () => atoms.map((a) => new THREE.Color(getResidueColor(a.residueOneLetter))),
    [atoms]
  );

  return (
    <group>
      {atoms.map((a, i) => {
        const isPicked = a.residueNumber === pickedResidueNumber;
        const isMutated = a.residueNumber === mutatedResidueNumber;
        const isHovered = hovered === i;
        const isInteresting = isPicked || isMutated || isHovered;

        // Hit sphere is always there (so clicks land), but only rendered
        // for interesting residues.
        const radius = isPicked ? 1.35 : isMutated ? 1.1 : isHovered ? 0.85 : 0.55;
        const color = isPicked
          ? new THREE.Color(0xffe066)
          : isMutated
          ? new THREE.Color(0xff3a3a)
          : isHovered
          ? colors[i].clone().offsetHSL(0, 0, 0.15)
          : colors[i];

        return (
          <mesh
            key={i}
            position={[a.x, a.y, a.z]}
            onPointerOver={(e) => {
              if (draggingRef.current) return;
              e.stopPropagation();
              setHovered(i);
              document.body.style.cursor = tool === 'cut' ? 'crosshair' : 'pointer';
            }}
            onPointerOut={() => {
              setHovered(null);
              document.body.style.cursor = '';
            }}
            onClick={(e) => {
              if (draggingRef.current) return;
              e.stopPropagation();
              if (tool === 'cut' && onCut) { onCut(i); return; }
              onPickResidue({
                index: i,
                residueNumber: a.residueNumber,
                residueOneLetter: a.residueOneLetter,
                atom: { x: a.x, y: a.y, z: a.z },
              });
            }}
          >
            <sphereGeometry args={[radius, isInteresting ? 20 : 8, isInteresting ? 20 : 8]} />
            <meshStandardMaterial
              color={color}
              transparent={!isInteresting}
              opacity={isInteresting ? 1 : 0}
              depthWrite={isInteresting}
              roughness={0.35}
              metalness={0.2}
              emissive={isPicked || isMutated ? color : 0x000000}
              emissiveIntensity={isPicked ? 0.75 : isMutated ? 0.55 : 0}
            />
          </mesh>
        );
      })}
    </group>
  );
}
