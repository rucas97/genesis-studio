import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  loadPDB, parsePDBCA, centerAtoms,
  type CAAtom, type PDBSource,
} from './pdbLoader';
import { CameraControls } from './CameraControls';
import { getResidueColor } from './proteinColors';
import { assignSecondaryStructure, ssSize } from './secondaryStructure';
import type { Segment } from './segments';
import { LigandMesh } from '../playground/LigandMesh';
import type { LigandEntry } from '../data/ligandLibrary';
import type { PickedResidue } from '../state/usePlaySession';

export type PlaygroundTool = 'select' | 'cut' | 'attach' | 'measure' | 'bind';

export interface ProteinViewerProps {
  pdbId: string;
  pickedResidueNumber: number | null;
  mutatedResidueNumber: number | null;
  onPickResidue: (picked: PickedResidue | null) => void;
  onSourceKnown?: (source: PDBSource) => void;
  onAtomsLoaded?: (count: number) => void;
  tool?: PlaygroundTool;
  segments?: Segment[];
  onCut?: (atomIndex: number) => void;
  measureAnchors?: number[];
  bindAnchors?: number[];
  activeLigand?: LigandEntry | null;
  ligandPosition?: [number, number, number];
  highlightedLigandAtom?: number | null;
  onLigandAtomClick?: (atomIndex: number) => void;
  bindingLink?: { proteinAtomIndex: number; ligandAtomIndex: number } | null;
}

const MEASURE_COLOR = 0xffaa00;
const BIND_COLOR = 0xcc88ff;

export function ProteinViewer({
  pdbId,
  pickedResidueNumber,
  mutatedResidueNumber,
  onPickResidue,
  onSourceKnown,
  onAtomsLoaded,
  tool = 'select',
  segments,
  onCut,
  measureAnchors = [],
  bindAnchors = [],
  activeLigand,
  ligandPosition = [40, 0, 0],
  highlightedLigandAtom = null,
  onLigandAtomClick,
  bindingLink,
}: ProteinViewerProps) {
  const [atoms, setAtoms] = useState<CAAtom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setAtoms(null);
    setError(null);
    loadPDB(pdbId)
      .then(({ text, source }) => {
        if (cancelled) return;
        onSourceKnown?.(source);
        const parsed = centerAtoms(parsePDBCA(text));
        setAtoms(parsed);
        onAtomsLoaded?.(parsed.length);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message ?? e));
      });
    return () => { cancelled = true; };
  }, [pdbId, onSourceKnown, onAtomsLoaded]);

  if (error) {
    return (
      <div className="placeholder">
        <div>Could not load {pdbId}.</div>
        <div><code>{error}</code></div>
      </div>
    );
  }

  if (!atoms) return <div className="placeholder">Loading {pdbId}…</div>;

  return (
    <div className="protein-viewer">
      <Canvas
        camera={{ position: [0, 0, 90], fov: 45, near: 0.5, far: 5000 }}
        style={{ background: '#060809' }}
        onPointerMissed={() => {
          if (draggingRef.current) return;
          if (tool === 'select') onPickResidue(null);
        }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={['#060809']} />
        <fog attach="fog" args={['#060809', 200, 500]} />

        <hemisphereLight args={[0x88aaff, 0x221100, 0.7]} />
        <directionalLight position={[30, 40, 30]} intensity={1.3} />
        <directionalLight position={[-30, -20, -20]} intensity={0.45} color={0x88aaff} />
        <pointLight position={[0, 0, 60]} intensity={0.55} color={0xffddaa} />

        <CameraControls
          draggingRef={draggingRef}
          autoRotate={!activeLigand}
          autoRotateSpeed={0.15}
          idleDelay={2.5}
        />

        <ProteinMesh
          atoms={atoms}
          pickedResidueNumber={pickedResidueNumber}
          mutatedResidueNumber={mutatedResidueNumber}
          draggingRef={draggingRef}
          tool={tool}
          segments={segments}
          onCut={onCut}
          onPickResidue={onPickResidue}
        />

        {activeLigand && (
          <LigandMesh
            ligand={activeLigand}
            position={ligandPosition}
            onAtomClick={onLigandAtomClick}
            highlightedAtom={highlightedLigandAtom}
          />
        )}

        <AnchorLine atoms={atoms} indices={measureAnchors} color={MEASURE_COLOR} />
        <AnchorLine atoms={atoms} indices={bindAnchors} color={BIND_COLOR} />

        {bindingLink && (
          <BindingLine
            atoms={atoms}
            ligand={activeLigand}
            proteinAtomIndex={bindingLink.proteinAtomIndex}
            ligandAtomIndex={bindingLink.ligandAtomIndex}
            ligandPosition={ligandPosition}
          />
        )}
      </Canvas>
    </div>
  );
}

interface ProteinMeshProps {
  atoms: CAAtom[];
  pickedResidueNumber: number | null;
  mutatedResidueNumber: number | null;
  draggingRef: React.MutableRefObject<boolean>;
  tool: PlaygroundTool;
  segments?: Segment[];
  onCut?: (atomIndex: number) => void;
  onPickResidue: (picked: PickedResidue | null) => void;
}

function ProteinMesh({
  atoms,
  pickedResidueNumber,
  mutatedResidueNumber,
  draggingRef,
  tool,
  segments,
  onCut,
  onPickResidue,
}: ProteinMeshProps) {
  const ss = useMemo(() => assignSecondaryStructure(atoms), [atoms]);

  const effectiveSegments = useMemo<Segment[]>(
    () => segments ?? [{ start: 0, end: atoms.length }],
    [segments, atoms.length]
  );

  const lines = useMemo(() => {
    return effectiveSegments.map((s) => {
      const count = Math.max(0, s.end - s.start);
      if (count < 2) return null;
      const positions = new Float32Array(count * 3);
      for (let i = s.start; i < s.end; i++) {
        const a = atoms[i];
        const j = i - s.start;
        positions[j * 3] = a.x;
        positions[j * 3 + 1] = a.y;
        positions[j * 3 + 2] = a.z;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      return new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x445566, transparent: true, opacity: 0.7 }));
    }).filter(Boolean);
  }, [atoms, effectiveSegments]);

  return (
    <group>
      {lines.map((line, i) => line ? <primitive key={i} object={line} /> : null)}

      {atoms.map((a, i) => {
        const isPicked = a.residueNumber === pickedResidueNumber;
        const isMutated = a.residueNumber === mutatedResidueNumber;
        const baseColor = getResidueColor(a.residueOneLetter);
        const structure = ss[i];
        const baseSize = ssSize(structure);

        let color = baseColor;
        let size = baseSize;
        if (structure === 'helix') color = blend(baseColor, 0x66ccff, 0.15);
        else if (structure === 'sheet') color = blend(baseColor, 0xffaa44, 0.15);
        if (isMutated) { color = 0xff4444; size = baseSize * 1.4; }
        if (isPicked) { color = 0xffe066; size = baseSize * 1.6; }

        const segs = structure === 'helix' ? 20 : 14;

        return (
          <mesh
            key={i}
            position={[a.x, a.y, a.z]}
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
            <sphereGeometry args={[size, segs, segs]} />
            <meshStandardMaterial
              color={color}
              roughness={0.45}
              metalness={0.15}
              emissive={isPicked || isMutated ? color : 0x000000}
              emissiveIntensity={isPicked || isMutated ? 0.35 : 0}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function AnchorLine({ atoms, indices, color }: { atoms: CAAtom[]; indices: number[]; color: number }) {
  const line = useMemo(() => {
    if (indices.length < 2) return null;
    const a = atoms[indices[0]];
    const b = atoms[indices[1]];
    if (!a || !b) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z], 3));
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color, linewidth: 2 }));
  }, [atoms, indices, color]);
  if (!line) return null;
  return <primitive object={line} />;
}

function BindingLine({
  atoms, ligand, proteinAtomIndex, ligandAtomIndex, ligandPosition,
}: {
  atoms: CAAtom[];
  ligand: LigandEntry | null | undefined;
  proteinAtomIndex: number;
  ligandAtomIndex: number;
  ligandPosition: [number, number, number];
}) {
  const line = useMemo(() => {
    if (!ligand) return null;
    const p = atoms[proteinAtomIndex];
    const l = ligand.atoms[ligandAtomIndex];
    if (!p || !l) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      p.x, p.y, p.z,
      l.x + ligandPosition[0], l.y + ligandPosition[1], l.z + ligandPosition[2],
    ], 3));
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x66ff88, linewidth: 3 }));
  }, [atoms, ligand, proteinAtomIndex, ligandAtomIndex, ligandPosition]);
  if (!line) return null;
  return <primitive object={line} />;
}

function blend(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (Math.round(ar + (br - ar) * t) << 16)
       | (Math.round(ag + (bg - ag) * t) << 8)
       |  Math.round(ab + (bb - ab) * t);
}
