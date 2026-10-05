import { useEffect, useMemo, useRef, useState } from 'react';
import { ProteinViewer, type PlaygroundTool } from '../scene/ProteinViewer';
import { usePlaySession, type PickedResidue } from '../state/usePlaySession';
import { ResiduePanel } from '../panels/ResiduePanel';
import { MutationPanel } from '../panels/MutationPanel';
import { AICard } from '../panels/AICard';
import { ProteinLibraryPanel } from '../panels/ProteinLibraryPanel';
import { LigandShelf } from '../playground/LigandShelf';
import { ToolBelt } from '../playground/ToolBelt';
import { useProject } from '../state/ProjectContext';
import { getProteinById, type ProteinEntry } from '../data/proteinLibrary';
import type { LigandEntry } from '../data/ligandLibrary';
import type { PDBSource } from '../scene/pdbLoader';
import {
  listCoScientists, getCoScientist, tryRegisterOllama,
} from '@genesis/ai';
import { cutAt, initialSegment, mergeSegments, type Segment } from '../scene/segments';

const DEFAULT_PROTEIN = 'egfr';

type AIState =
  | { kind: 'checking' }
  | { kind: 'stub' }
  | { kind: 'ollama'; model: string; baseUrl: string };

export function PlayTab() {
  const {
    log, projectId,
    pendingSendToPlay, clearPendingSendToPlay,
    refreshActionCount,
  } = useProject();

  const [proteinId, setProteinId] = useState(DEFAULT_PROTEIN);
  const protein = useMemo(
    () => getProteinById(proteinId) ?? getProteinById(DEFAULT_PROTEIN)!,
    [proteinId]
  );

  const session = usePlaySession({
    log, projectId,
    pdbId: protein.pdbId,
    proteinName: protein.name,
    geneName: protein.gene,
  });

  const consumedRef = useRef(false);
  const [source, setSource] = useState<PDBSource | null>(null);
  const [ai, setAi] = useState<AIState>({ kind: 'checking' });

  // Playground state
  const [tool, setTool] = useState<PlaygroundTool>('select');
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [atomCount, setAtomCount] = useState(0);
  const [measureAnchors, setMeasureAnchors] = useState<number[]>([]);
  const [bindAnchors, setBindAnchors] = useState<number[]>([]);
  const [measureDistance, setMeasureDistance] = useState<number | null>(null);
  const [cutCount, setCutCount] = useState(0);

  // Ligand state
  const [activeLigand, setActiveLigand] = useState<LigandEntry | null>(null);
  const [ligandPosition] = useState<[number, number, number]>([40, 0, 0]);
  const [pendingProteinAtom, setPendingProteinAtom] = useState<number | null>(null);
  const [highlightedLigandAtom, setHighlightedLigandAtom] = useState<number | null>(null);
  const [binding, setBinding] = useState<{
    proteinAtomIndex: number;
    ligandAtomIndex: number;
    distance: number;
    kdNm: number;
  } | null>(null);

  const atomCoordsRef = useRef<Map<number, { x: number; y: number; z: number }>>(new Map());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const health = await tryRegisterOllama();
      if (cancelled) return;
      if (health) setAi({ kind: 'ollama', model: health.chosenModel, baseUrl: health.baseUrl });
      else setAi({ kind: 'stub' });
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!pendingSendToPlay) return;
    if (consumedRef.current) return;
    consumedRef.current = true;
    const payload = pendingSendToPlay;
    clearPendingSendToPlay();
    void session.bridgeIn(payload.variant, payload.molecule).then(() => {
      refreshActionCount();
    });
  }, [pendingSendToPlay, clearPendingSendToPlay, session, refreshActionCount]);

  const handlePickProtein = (p: ProteinEntry) => {
    setProteinId(p.id);
    session.pickResidue(null);
    setSource(null);
    setSegments(null);
    setMeasureAnchors([]);
    setBindAnchors([]);
    setMeasureDistance(null);
    setCutCount(0);
    atomCoordsRef.current.clear();
    consumedRef.current = false;
    setBinding(null);
    setPendingProteinAtom(null);
    setHighlightedLigandAtom(null);
  };

  const handlePickResidue = (picked: PickedResidue | null) => {
    if (tool === 'select') {
      session.pickResidue(picked);
      return;
    }
    if (!picked) return;

    atomCoordsRef.current.set(picked.index, picked.atom);

    if (tool === 'bind') {
      setPendingProteinAtom(picked.index);
      setHighlightedLigandAtom(null);
      return;
    }

    if (tool === 'measure') {
      setMeasureAnchors((prev) => {
        const next = prev.length >= 2 ? [picked.index] : [...prev, picked.index];
        if (next.length === 2) {
          const a = atomCoordsRef.current.get(next[0]);
          const b = atomCoordsRef.current.get(next[1]);
          if (a && b) {
            setMeasureDistance(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
          }
        } else {
          setMeasureDistance(null);
        }
        return next;
      });
      return;
    }

    if (tool === 'attach') {
      setBindAnchors((prev) => {
        const next = prev.length >= 2 ? [picked.index] : [...prev, picked.index];
        if (next.length === 2 && segments) {
          setSegments(mergeSegments(segments, next[0], next[1]));
          return [];
        }
        return next;
      });
      return;
    }
  };

  const handleLigandAtomClick = (atomIndex: number) => {
    if (!activeLigand) return;
    setHighlightedLigandAtom(atomIndex);
    if (tool !== 'bind' || pendingProteinAtom === null) return;

    const proteinAtom = atomCoordsRef.current.get(pendingProteinAtom);
    const ligandAtom = activeLigand.atoms[atomIndex];
    if (!proteinAtom || !ligandAtom) return;

    const px = proteinAtom.x;
    const py = proteinAtom.y;
    const pz = proteinAtom.z;
    const lx = ligandAtom.x + ligandPosition[0];
    const ly = ligandAtom.y + ligandPosition[1];
    const lz = ligandAtom.z + ligandPosition[2];
    const distance = Math.hypot(px - lx, py - ly, pz - lz);

    // Stub score: Gaussian peak at 3.5 Å with sigma 1.5 Å.
    const optimal = 3.5;
    const sigma = 1.5;
    const score = Math.exp(-((distance - optimal) ** 2) / (2 * sigma * sigma));
    // Map score 0..1 to Kd from 10 nM to 100 µM.
    const kdNm = 10 * Math.pow(10000, 1 - score);

    setBinding({
      proteinAtomIndex: pendingProteinAtom,
      ligandAtomIndex: atomIndex,
      distance,
      kdNm,
    });
    setPendingProteinAtom(null);
    refreshActionCount();
  };

  const handleCut = (atomIndex: number) => {
    setSegments((prev) => {
      const current = prev ?? initialSegment(atomCount);
      setCutCount((c) => c + 1);
      return cutAt(current, atomIndex);
    });
  };

  const handleToolChange = (t: PlaygroundTool) => {
    setTool(t);
    setMeasureAnchors([]);
    setBindAnchors([]);
    setMeasureDistance(null);
    setPendingProteinAtom(null);
    setHighlightedLigandAtom(null);
  };

  const handleLigandPick = (l: LigandEntry | null) => {
    setActiveLigand(l);
    setBinding(null);
    setPendingProteinAtom(null);
    setHighlightedLigandAtom(null);
  };

  const aiName = getCoScientist().name;
  const registered = listCoScientists().map((c) => c.name);

  return (
    <div className="play-layout">
      <div className="play-scene">
        <ProteinViewer
          pdbId={protein.pdbId}
          pickedResidueNumber={session.picked?.residueNumber ?? null}
          mutatedResidueNumber={session.variant?.position ?? null}
          onPickResidue={handlePickResidue}
          onSourceKnown={setSource}
          onAtomsLoaded={setAtomCount}
          tool={tool}
          segments={segments ?? undefined}
          onCut={handleCut}
          measureAnchors={measureAnchors}
          bindAnchors={bindAnchors}
          activeLigand={activeLigand}
          ligandPosition={ligandPosition}
          highlightedLigandAtom={highlightedLigandAtom}
          onLigandAtomClick={handleLigandAtomClick}
          bindingLink={
            binding
              ? {
                  proteinAtomIndex: binding.proteinAtomIndex,
                  ligandAtomIndex: binding.ligandAtomIndex,
                }
              : null
          }
        />
        <div className="scene-overlay">
          <strong>Play</strong> · {protein.pdbId} · {protein.gene} ·{' '}
          {source === 'local' ? 'local cache' : source === 'rcsb' ? 'RCSB (online)' : '…'}
          {segments && segments.length > 1 && (
            <> · <span style={{ color: '#ffaa44' }}>{segments.length} fragments · {cutCount} cuts</span></>
          )}
          {activeLigand && (
            <> · <span style={{ color: '#66ff88' }}>ligand: {activeLigand.name}</span></>
          )}
        </div>
        <ToolBelt
          tool={tool}
          onToolChange={handleToolChange}
          measureDistance={measureDistance}
          onClearMeasure={() => { setMeasureAnchors([]); setMeasureDistance(null); }}
          segmentCount={segments?.length}
          onResetSegments={() => { setSegments(null); setCutCount(0); }}
        />
      </div>

      <aside className="play-sidebar">
        <ProteinLibraryPanel currentId={proteinId} onPick={handlePickProtein} />
        <LigandShelf activeId={activeLigand?.id ?? null} onPick={handleLigandPick} />

        <div className="panel">
          <div className="panel-label">Loaded</div>
          <div className="panel-value">{protein.gene}</div>
          <div className="panel-hint mono">{protein.pdbId} · {atomCount} residues</div>
          <div className="panel-hint"><em>{protein.why}</em></div>
        </div>

        <div className="panel">
          <div className="panel-label">Active tool</div>
          <div className="panel-value mono">{tool}</div>
          <div className="panel-hint">
            {tool === 'select' && 'Click a residue to pick it, then mutate.'}
            {tool === 'cut' && 'Click a residue to split the chain there.'}
            {tool === 'attach' && 'Click two residues in different fragments to merge.'}
            {tool === 'measure' && 'Click two residues to see the distance.'}
            {tool === 'bind' && (activeLigand
              ? 'Click a protein residue, then a ligand atom.'
              : 'Pick a ligand from the shelf first.')}
          </div>
        </div>

        {binding && activeLigand && (
          <div className="panel binding-panel">
            <div className="panel-label">Binding estimate</div>
            <div className="binding-row">
              <span>Distance</span>
              <span className="mono">{binding.distance.toFixed(2)} Å</span>
            </div>
            <div className="binding-row">
              <span>Estimated Kd</span>
              <span className="mono">
                {binding.kdNm < 1000
                  ? `${binding.kdNm.toFixed(1)} nM`
                  : `${(binding.kdNm / 1000).toFixed(2)} µM`}
              </span>
            </div>
            <div className="stub-note">
              Geometric stub. Not a real docking score. Verify with a real method.
            </div>
            <button className="zoom-btn" onClick={() => setBinding(null)}>Clear</button>
          </div>
        )}

        <div className="panel">
          <div className="panel-label">AI co-scientist</div>
          <div className="panel-value mono">{aiName}</div>
          {ai.kind === 'checking' && <div className="panel-hint">checking for Ollama…</div>}
          {ai.kind === 'stub' && (
            <div className="panel-hint">Ollama not detected. Using stub.</div>
          )}
          {ai.kind === 'ollama' && (
            <div className="panel-hint">Local LLM: <strong>{ai.model}</strong>.</div>
          )}
          <div className="panel-hint mono">registered: {registered.join(', ')}</div>
        </div>

        {session.picked && tool === 'select' && (
          <ResiduePanel
            residue={session.picked}
            disabled={session.status === 'predicting'}
            onMutate={(aa) => { void session.mutate(aa).then(refreshActionCount); }}
          />
        )}

        {session.variant && (
          <MutationPanel variant={session.variant} prediction={session.prediction} />
        )}

        {session.observation && (
          <AICard observation={session.observation} hypothesis={session.hypothesis} />
        )}
      </aside>
    </div>
  );
}
