import { useCallback, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { CAAtom } from './pdbLoader';
import { assignSecondaryStructure, type SecondaryStructure } from './secondaryStructure';
import type { Segment } from './segments';

const SS_COLORS: Record<SecondaryStructure, number> = {
  helix: 0x5aa9ff, sheet: 0xf0b64a, coil: 0x6a7a92,
};
const SS_RADII: Record<SecondaryStructure, number> = {
  helix: 0.62, sheet: 0.48, coil: 0.22,
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
  segments?: Segment[];
  atomColors?: Map<number, number>;
  onHoverAtom?: (index: number | null) => void;
  onClickAtom?: (index: number) => void;
}

export function BackboneRibbon({
  atoms, atomColors, segments, onHoverAtom, onClickAtom,
}: BackboneRibbonProps) {
  const ss = useMemo(() => assignSecondaryStructure(atoms), [atoms]);
  const runs = useMemo(() => splitRuns(ss), [ss]);
  const lastHoverRef = useRef<number | null>(null);
  const lastHoverTimeRef = useRef(0);

  const nearestAtom = useCallback((point: THREE.Vector3): number | null => {
    if (atoms.length === 0) return null;
    let best = -1; let bestD = Infinity;
    for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i];
      const dx = a.x - point.x, dy = a.y - point.y, dz = a.z - point.z;
      const d = dx*dx + dy*dy + dz*dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best >= 0 ? best : null;
  }, [atoms]);

  const handleMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!onHoverAtom) return;
    const now = performance.now();
    if (now - lastHoverTimeRef.current < 33) return;
    lastHoverTimeRef.current = now;
    e.stopPropagation();
    const idx = nearestAtom(e.point);
    if (idx !== lastHoverRef.current) {
      lastHoverRef.current = idx;
      onHoverAtom(idx);
    }
  }, [onHoverAtom, nearestAtom]);

  const handleOut = useCallback(() => {
    if (!onHoverAtom) return;
    lastHoverRef.current = null;
    onHoverAtom(null);
  }, [onHoverAtom]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (!onClickAtom) return;
    e.stopPropagation();
    const idx = nearestAtom(e.point);
    if (idx !== null) onClickAtom(idx);
  }, [onClickAtom, nearestAtom]);

  // Intersect the secondary-structure runs with the user's segments.
  // Each segment is a connected piece of the chain; a cut between two
  // segments produces a visible gap.
  const pieces = useMemo(() => {
    const eff = segments && segments.length > 0
      ? segments
      : [{ start: 0, end: atoms.length }];
    const out: Run[] = [];
    for (const run of runs) {
      for (const seg of eff) {
        const start = Math.max(run.start, seg.start);
        const end = Math.min(run.end, seg.end);
        if (end - start >= 2) out.push({ ss: run.ss, start, end });
      }
    }
    return out;
  }, [runs, segments, atoms.length]);

  const tubes = useMemo(() => {
    return pieces.map((run) => {
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
        colorAttr[i*3] = c.r; colorAttr[i*3+1] = c.g; colorAttr[i*3+2] = c.b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3));
      const material = new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.35, metalness: 0.15, envMapIntensity: 0.6,
      });
      return { geometry, material, key: `run-${run.start}-${run.end}` };
    }).filter(Boolean) as Array<{ geometry: THREE.TubeGeometry; material: THREE.MeshStandardMaterial; key: string }>;
  }, [pieces, atoms, atomColors]);

  return (
    <group>
      {tubes.map((t) => (
        <mesh
          key={t.key}
          geometry={t.geometry}
          material={t.material}
          onPointerMove={handleMove}
          onPointerOut={handleOut}
          onClick={handleClick}
        />
      ))}
    </group>
  );
}
