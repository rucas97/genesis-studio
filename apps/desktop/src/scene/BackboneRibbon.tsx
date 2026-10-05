import { useMemo } from 'react';
import * as THREE from 'three';
import type { CAAtom } from './pdbLoader';
import { assignSecondaryStructure, type SecondaryStructure } from './secondaryStructure';

const SS_COLORS: Record<SecondaryStructure, number> = {
  helix: 0x5aa9ff,
  sheet: 0xf0b64a,
  coil:  0x6a7a92,
};
// Thinner tubes so side chains are visible above the ribbon.
const SS_RADII: Record<SecondaryStructure, number> = {
  helix: 0.62,
  sheet: 0.48,
  coil:  0.22,
};

interface Run { ss: SecondaryStructure; start: number; end: number; }

function splitRuns(ss: SecondaryStructure[]): Run[] {
  const runs: Run[] = [];
  let i = 0;
  while (i < ss.length) {
    const t = ss[i];
    let j = i + 1;
    while (j < ss.length && ss[j] === t) j++;
    if (j - i >= 2) runs.push({ ss: t, start: i, end: j });
    i = j;
  }
  return runs;
}

export interface BackboneRibbonProps {
  atoms: CAAtom[];
  atomColors?: Map<number, number>;
}

export function BackboneRibbon({ atoms, atomColors }: BackboneRibbonProps) {
  const ss = useMemo(() => assignSecondaryStructure(atoms), [atoms]);
  const runs = useMemo(() => splitRuns(ss), [ss]);

  const tubes = useMemo(() => {
    return runs.map((run) => {
      const points: THREE.Vector3[] = [];
      for (let i = run.start; i < run.end; i++) {
        const a = atoms[i];
        points.push(new THREE.Vector3(a.x, a.y, a.z));
      }
      if (points.length < 2) return null;

      const curve = new THREE.CatmullRomCurve3(points);
      const tubularSegments = Math.max(6, Math.floor(points.length * 2));
      const radius = SS_RADII[run.ss];
      const radialSegments = 8;
      const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);

      const vertCount = geometry.attributes.position.count;
      const colorAttr = new Float32Array(vertCount * 3);
      const baseColor = new THREE.Color(SS_COLORS[run.ss]);
      const perStrand = radialSegments + 1;
      const usedOverride = atomColors && atomColors.size > 0;
      for (let i = 0; i < vertCount; i++) {
        const tubIdx = Math.floor(i / perStrand);
        const t = tubularSegments === 0 ? 0 : tubIdx / tubularSegments;
        const atomIdx = run.start + Math.round(t * (run.end - run.start - 1));
        let c = baseColor;
        if (usedOverride) {
          const override = atomColors.get(atomIdx);
          if (override !== undefined) c = new THREE.Color(override);
        }
        colorAttr[i * 3] = c.r;
        colorAttr[i * 3 + 1] = c.g;
        colorAttr[i * 3 + 2] = c.b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3));

      const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.35,
        metalness: 0.15,
        envMapIntensity: 0.6,
      });

      return { geometry, material, key: `run-${run.start}-${run.end}` };
    }).filter(Boolean) as Array<{ geometry: THREE.TubeGeometry; material: THREE.MeshStandardMaterial; key: string }>;
  }, [runs, atoms, atomColors]);

  return (
    <group>
      {tubes.map((t) => (
        <mesh key={t.key} geometry={t.geometry} material={t.material} />
      ))}
    </group>
  );
}
