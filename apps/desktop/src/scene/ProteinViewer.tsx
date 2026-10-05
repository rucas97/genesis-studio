import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import {
  loadPDB, parsePDBCA, centerAtoms,
  type CAAtom, type PDBSource,
} from './pdbLoader';
import { CameraControls } from './CameraControls';
import { BackboneRibbon } from './BackboneRibbon';
import { SideChains } from './SideChains';
import { AmbientParticles } from './AmbientParticles';
import type { Segment } from './segments';
import { LigandMesh } from '../playground/LigandMesh';
import type { LigandEntry } from '../data/ligandLibrary';
import type { PickedResidue } from '../state/usePlaySession';

export type PlaygroundTool = 'select' | 'cut' | 'attach' | 'measure' | 'bind';

export interface PlacedLigandRender {
  instanceId: string;
  ligand: LigandEntry;
  position: [number, number, number];
}

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
  placedLigands?: PlacedLigandRender[];
  onLigandPositionChange?: (instanceId: string, p: [number, number, number]) => void;
  onLigandDragEnd?: (instanceId: string, p: [number, number, number]) => void;
  highlightedLigandAtom?: number | null;
  highlightedLigandInstance?: string | null;
  onLigandAtomClick?: (instanceId: string, atomIndex: number) => void;
  bindingLink?: { proteinAtomIndex: number; ligandAtomIndex: number; ligandInstanceId: string } | null;
}

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
  placedLigands = [],
  onLigandPositionChange,
  onLigandDragEnd,
  highlightedLigandAtom = null,
  highlightedLigandInstance = null,
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

  const bindingLigand = bindingLink
    ? placedLigands.find((p) => p.instanceId === bindingLink.ligandInstanceId)
    : null;

  return (
    <div className="protein-viewer">
      <Canvas
        camera={{ position: [0, 0, 90], fov: 42, near: 0.5, far: 8000 }}
        onPointerMissed={() => {
          if (draggingRef.current) return;
          if (tool === 'select') onPickResidue(null);
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        dpr={[1, 2]}
      >
        <fog attach="fog" args={['#04060a', 220, 520]} />

        <hemisphereLight args={[0x6c9fff, 0x1a0e2a, 0.85]} />
        <directionalLight position={[40, 60, 40]} intensity={1.6} color={0xfff0d8} />
        <directionalLight position={[-50, -30, -30]} intensity={0.55} color={0x4a90e2} />
        <pointLight position={[0, 0, 90]} intensity={0.7} color={0xffd0a0} distance={300} />
        <pointLight position={[0, 60, -60]} intensity={0.4} color={0x88ccff} distance={400} />

        <AmbientParticles count={340} radius={140} />

        <CameraControls
          draggingRef={draggingRef}
          autoRotate={placedLigands.length === 0}
          autoRotateSpeed={0.12}
          idleDelay={3}
        />

        <group>
          <BackboneRibbon atoms={atoms} />
          <SideChains
            atoms={atoms}
            pickedResidueNumber={pickedResidueNumber}
            mutatedResidueNumber={mutatedResidueNumber}
            draggingRef={draggingRef}
            onPickResidue={onPickResidue}
            onCut={onCut}
            tool={tool}
          />
        </group>

        {placedLigands.map((pl) => (
          <LigandMesh
            key={pl.instanceId}
            instanceId={pl.instanceId}
            ligand={pl.ligand}
            position={pl.position}
            onPositionChange={onLigandPositionChange ?? (() => {})}
            onDragStart={() => { draggingRef.current = true; }}
            onDragEnd={(id, p) => {
              draggingRef.current = false;
              onLigandDragEnd?.(id, p);
            }}
            onAtomClick={onLigandAtomClick}
            highlightedAtom={
              highlightedLigandInstance === pl.instanceId ? highlightedLigandAtom : null
            }
            draggable
          />
        ))}

        <AnchorLine atoms={atoms} indices={measureAnchors} color={0xffaa00} />
        <AnchorLine atoms={atoms} indices={bindAnchors} color={0xcc88ff} />

        {bindingLink && bindingLigand && (
          <BindingLine
            atoms={atoms}
            ligand={bindingLigand.ligand}
            proteinAtomIndex={bindingLink.proteinAtomIndex}
            ligandAtomIndex={bindingLink.ligandAtomIndex}
            ligandPosition={bindingLigand.position}
          />
        )}
      </Canvas>
    </div>
  );
}

function AnchorLine({ atoms, indices, color }: { atoms: CAAtom[]; indices: number[]; color: number }) {
  const line = useMemo(() => {
    if (indices.length < 2) return null;
    const a = atoms[indices[0]]; const b = atoms[indices[1]];
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
  ligand: LigandEntry;
  proteinAtomIndex: number;
  ligandAtomIndex: number;
  ligandPosition: [number, number, number];
}) {
  const line = useMemo(() => {
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
