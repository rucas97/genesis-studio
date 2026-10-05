import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { loadPDB, parsePDBCA, centerAtoms, type CAAtom } from '../scene/pdbLoader';
import { BackboneRibbon } from '../scene/BackboneRibbon';
import { LigandMesh } from '../playground/LigandMesh';
import { getLigandById } from '../data/ligandLibrary';

export interface PlaySnapshot {
  proteinId: string;
  pdbId: string;
  pickedResidueNumber: number | null;
  mutatedResidueNumber: number | null;
  mutatedHgvs: string | null;
  ligands: Array<{
    instanceId: string;
    ligandId: string;
    position: [number, number, number];
  }>;
}

export interface MiniPlayViewProps {
  snapshot: PlaySnapshot;
}

export function MiniPlayView({ snapshot }: MiniPlayViewProps) {
  const [atoms, setAtoms] = useState<CAAtom[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAtoms(null);
    setError(null);
    loadPDB(snapshot.pdbId)
      .then(({ text }) => {
        if (cancelled) return;
        setAtoms(centerAtoms(parsePDBCA(text)));
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message ?? e));
      });
    return () => { cancelled = true; };
  }, [snapshot.pdbId]);

  const highlightColors = useMemo(() => {
    const m = new Map<number, number>();
    if (atoms && snapshot.pickedResidueNumber !== null) {
      atoms.forEach((a, i) => {
        if (a.residueNumber === snapshot.pickedResidueNumber) m.set(i, 0xffe066);
      });
    }
    if (atoms && snapshot.mutatedResidueNumber !== null) {
      atoms.forEach((a, i) => {
        if (a.residueNumber === snapshot.mutatedResidueNumber) m.set(i, 0xff3a3a);
      });
    }
    return m;
  }, [atoms, snapshot.pickedResidueNumber, snapshot.mutatedResidueNumber]);

  if (error) {
    return <div className="mini-view-error">Could not load {snapshot.pdbId}</div>;
  }
  if (!atoms) return <div className="mini-view-loading">Loading…</div>;

  return (
    <div className="mini-view-canvas">
      <Canvas
        camera={{ position: [0, 0, 110], fov: 45, near: 0.5, far: 3000 }}
        gl={{ antialias: true, alpha: true }}
        dpr={1}
        style={{ background: 'transparent' }}
      >
        <hemisphereLight args={[0x88aaff, 0x221100, 0.9]} />
        <directionalLight position={[30, 40, 30]} intensity={1.1} />
        <directionalLight position={[-20, -10, -20]} intensity={0.4} color={0x88aaff} />

        <BackboneRibbon atoms={atoms} atomColors={highlightColors} />

        {snapshot.ligands.map((pl) => {
          const entry = getLigandById(pl.ligandId);
          if (!entry) return null;
          return (
            <LigandMesh
              key={pl.instanceId}
              instanceId={pl.instanceId}
              ligand={entry}
              position={pl.position}
              onPositionChange={() => {}}
              draggable={false}
            />
          );
        })}
      </Canvas>
      <div className="mini-view-label">
        {snapshot.mutatedHgvs ?? 'no variant'} · {snapshot.ligands.length} ligand{snapshot.ligands.length === 1 ? '' : 's'}
      </div>
    </div>
  );
}
