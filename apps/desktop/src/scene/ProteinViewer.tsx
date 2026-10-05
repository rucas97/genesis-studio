import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  loadPDB,
  parsePDBCA,
  centerAtoms,
  type CAAtom,
  type PDBSource,
} from './pdbLoader';
import { CameraControls } from './CameraControls';
import { getResidueColor } from './proteinColors';
import { assignSecondaryStructure, ssSize } from './secondaryStructure';
import type { Segment } from './segments';
import type { PickedResidue } from '../state/usePlaySession';

export type PlaygroundTool = 'select' | 'cut' | 'attach' | 'measure' | 'bind';

export interface ProteinViewerProps {
  pdbId: string;
  pickedResidueNumber: number | null;
  mutatedResidueNumber: number | null;
  onPickResidue: (picked: PickedResidue | null) => void;
  onSourceKnown?: (source: PDBSource) => void;
  tool?: PlaygroundTool;
  segments?: Segment[];
  onCut?: (atomIndex: number) => void;
  measureAnchors?: number[];
  bindAnchors?: number[];
}

const MEASURE_COLOR = 0xffaa00;
const BIND_COLOR = 0xcc88ff;

export function ProteinViewer({
  pdbId,
  pickedResidueNumber,
  mutatedResidueNumber,
  onPickResidue,
  onSourceKnown,
  tool = 'select',
  segments,
  onCut,
  measureAnchors = [],
  bindAnchors = [],
}: ProteinViewerProps) {
  const [atoms, setAtoms] = useState<CAAtom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const draggingRef = useRef(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setAtoms(null);
    setError(null);
    loadPDB(pdbId)
      .then(({ text, source }) => {
        if (cancelled) return;
        onSourceKnown?.(source);
        setAtoms(centerAtoms(parsePDBCA(text)));
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message ?? e));
      });
    return () => { cancelled = true; };
  }, [pdbId, onSourceKnown]);

  if (error) {
    return (
      <div className="placeholder">
        <div>Could not load {pdbId}.</div>
        <div><code>{error}</code></div>
        <div>
          Try priming the local cache: <code>bash scripts/fetch-pdb.sh {pdbId}</code>
        </div>
      </div>
    );
  }

  if (!atoms) return <div className="placeholder">Loading {pdbId}…</div>;

  return (
    <div className="protein-viewer">
      <Canvas
        key={resetKey}
        camera={{ position: [0, 0, 90], fov: 45, near: 0.5, far: 5000 }}
        style={{ background: 'radial-gradient(circle at 50% 40%, #0f1419 0%, #060809 100%)' }}
        onPointerMissed={() => {
          if (draggingRef.current) return;
          if (tool === 'select') onPickResidue(null);
        }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={['#060809']} />
        <fog attach="fog" args={['#060809', 180, 400]} />

        <hemisphereLight args={[0x88aaff, 0x221100, 0.6]} />
        <directionalLight position={[30, 40, 30]} intensity={1.2} color={0xffffff} />
        <directionalLight position={[-30, -20, -20]} intensity={0.4} color={0x88aaff} />
        <pointLight position={[0, 0, 60]} intensity={0.5} color={0xffddaa} />

        <CameraControls
          draggingRef={draggingRef}
          autoRotate
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

        <MeasureAnchors atoms={atoms} indices={measureAnchors} color={MEASURE_COLOR} />
        <MeasureAnchors atoms={atoms} indices={bindAnchors} color={BIND_COLOR} />
      </Canvas>

      <div className="viewer-hint">
        <strong>drag</strong> orbit · <strong>right-drag</strong> pan · <strong>scroll</strong> zoom
        <button className="viewer-reset" onClick={() => setResetKey((k) => k + 1)}>
          Reset view
        </button>
      </div>
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

  // Backbone lines, one per segment.
  const lines = useMemo(() => {
    return effectiveSegments.map((s) => {
      const count = s.end - s.start;
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
      const m = new THREE.LineBasicMaterial({
        color: 0x445566,
        transparent: true,
        opacity: 0.7,
      });
      return new THREE.Line(g, m);
    });
  }, [atoms, effectiveSegments]);

  return (
    <group>
      {lines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}

      {atoms.map((a, i) => {
        const isPicked = a.residueNumber === pickedResidueNumber;
        const isMutated = a.residueNumber === mutatedResidueNumber;
        const baseColor = getResidueColor(a.residueOneLetter);
        const structure = ss[i];
        const size = ssSize(structure);

        let color = baseColor;
        let finalSize = size;
        if (structure === 'helix') {
          color = blend(baseColor, 0x66ccff, 0.15);
        } else if (structure === 'sheet') {
          color = blend(baseColor, 0xffaa44, 0.15);
        }
        if (isMutated) {
          color = 0xff4444;
          finalSize = size * 1.4;
        }
        if (isPicked) {
          color = 0xffe066;
          finalSize = size * 1.6;
        }

        const segments_count = structure === 'helix' ? 20 : 14;

        return (
          <mesh
            key={i}
            position={[a.x, a.y, a.z]}
            onClick={(e) => {
              if (draggingRef.current) return;
              e.stopPropagation();
              if (tool === 'cut' && onCut) {
                onCut(i);
                return;
              }
              onPickResidue({
                index: i,
                residueNumber: a.residueNumber,
                residueOneLetter: a.residueOneLetter,
                atom: { x: a.x, y: a.y, z: a.z },
              });
            }}
          >
            <sphereGeometry args={[finalSize, segments_count, segments_count]} />
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

function MeasureAnchors({
  atoms,
  indices,
  color,
}: {
  atoms: CAAtom[];
  indices: number[];
  color: number;
}) {
  const line = useMemo(() => {
    if (indices.length < 2) return null;
    const a = atoms[indices[0]];
    const b = atoms[indices[1]];
    if (!a || !b) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      a.x, a.y, a.z, b.x, b.y, b.z,
    ], 3));
    return new THREE.Line(
      g,
      new THREE.LineBasicMaterial({ color, linewidth: 2 })
    );
  }, [atoms, indices, color]);

  if (!line) return null;
  return <primitive object={line} />;
}

function blend(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
