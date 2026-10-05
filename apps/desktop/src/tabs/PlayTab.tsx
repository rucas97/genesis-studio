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
import { getLigandById, type LigandEntry } from '../data/ligandLibrary';
import type { PDBSource } from '../scene/pdbLoader';
import { listCoScientists, getCoScientist, tryRegisterOllama } from '@genesis/ai';
import { cutAt, initialSegment, mergeSegments, type Segment } from '../scene/segments';
import { dockWithSidecar, localGeometricDock } from '@genesis/engines';

const DEFAULT_PROTEIN = 'egfr';

interface PlacedLigand {
  instanceId: string;
  entry: LigandEntry;
  position: [number, number, number];
}

interface BindingInfo {
  instanceId: string;
  ligandName: string;
  ligandAtomIndex: number;
  proteinAtomIndex: number;
  distance: number;
  kdNm: number;
  method: string;
  notes: string;
}

type AIState =
  | { kind: 'checking' }
  | { kind: 'stub' }
  | { kind: 'ollama'; model: string; baseUrl: string };

let ligandInstanceCounter = 0;
function nextLigandInstanceId(): string {
  ligandInstanceCounter += 1;
  return `lig_${Date.now().toString(36)}_${ligandInstanceCounter}`;
}

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

  const [tool, setTool] = useState<PlaygroundTool>('select');
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [atomCount, setAtomCount] = useState(0);
  const [measureAnchors, setMeasureAnchors] = useState<number[]>([]);
  const [bindAnchors, setBindAnchors] = useState<number[]>([]);
  const [measureDistance, setMeasureDistance] = useState<number | null>(null);
  const [cutCount, setCutCount] = useState(0);

  // Multi-ligand
  const [ligands, setLigands] = useState<PlacedLigand[]>([]);
  const [pendingProteinAtom, setPendingProteinAtom] = useState<number | null>(null);
  const [pendingLigandInstance, setPendingLigandInstance] = useState<string | null>(null);
  const [highlightedLigandAtom, setHighlightedLigandAtom] = useState<number | null>(null);
  const [binding, setBinding] = useState<BindingInfo | null>(null);

  const atomCoordsRef = useRef<Map<number, { x: number; y: number; z: number }>>(new Map());
  const pickedRef = useRef<PickedResidue | null>(null);
  const lastLoggedProteinRef = useRef<string>('');

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

  useEffect(() => { pickedRef.current = session.picked; }, [session.picked]);

  // Log protein changes so replay can restore them.
  useEffect(() => {
    if (lastLoggedProteinRef.current === protein.id) return;
    lastLoggedProteinRef.current = protein.id;
    void log.append({
      projectId, mode: 'play', actor: 'user', type: 'play.set_protein',
      payload: { proteinId: protein.id, pdbId: protein.pdbId },
      timestamp: new Date().toISOString(),
    }).then(refreshActionCount);
  }, [protein, log, projectId, refreshActionCount]);

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
    setPendingLigandInstance(null);
    setHighlightedLigandAtom(null);
    setLigands([]);
  };

  const handlePickResidue = (picked: PickedResidue | null) => {
    if (tool === 'select') {
      session.pickResidue(picked);
      if (picked) {
        void log.append({
          projectId, mode: 'play', actor: 'user', type: 'play.pick_residue',
          payload: { residueNumber: picked.residueNumber },
          timestamp: new Date().toISOString(),
        }).then(refreshActionCount);
      }
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
          if (a && b) setMeasureDistance(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
        } else setMeasureDistance(null);
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

  const handleAddLigand = (entry: LigandEntry) => {
    const existing = ligands.length;
    const offset = 40 + existing * 18;
    const instanceId = nextLigandInstanceId();
    const position: [number, number, number] = [offset, 0, 0];
    setLigands((prev) => [...prev, { instanceId, entry, position }]);
    setBinding(null);
    void log.append({
      projectId, mode: 'play', actor: 'user', type: 'play.add_ligand',
      payload: { instanceId, ligandId: entry.id, position },
      timestamp: new Date().toISOString(),
    }).then(refreshActionCount);
  };

  const handleRemoveLigand = (instanceId: string) => {
    setLigands((prev) => prev.filter((l) => l.instanceId !== instanceId));
    void log.append({
      projectId, mode: 'play', actor: 'user', type: 'play.remove_ligand',
      payload: { instanceId },
      timestamp: new Date().toISOString(),
    }).then(refreshActionCount);
  };

  const handleLigandPositionChange = (instanceId: string, p: [number, number, number]) => {
    setLigands((prev) => prev.map((l) => l.instanceId === instanceId ? { ...l, position: p } : l));
  };

  const handleLigandDragEnd = (instanceId: string, position: [number, number, number]) => {
    void log.append({
      projectId, mode: 'play', actor: 'user', type: 'play.move_ligand',
      payload: { instanceId, to: position },
      timestamp: new Date().toISOString(),
    }).then(refreshActionCount);
  };

  const handleLigandAtomClick = async (instanceId: string, atomIndex: number) => {
    const placed = ligands.find((l) => l.instanceId === instanceId);
    if (!placed) return;
    setHighlightedLigandAtom(atomIndex);
    setPendingLigandInstance(instanceId);

    if (tool !== 'bind' || pendingProteinAtom === null) return;
    const proteinAtom = atomCoordsRef.current.get(pendingProteinAtom);
    const ligandAtom = placed.entry.atoms[atomIndex];
    if (!proteinAtom || !ligandAtom) return;

    const lx = ligandAtom.x + placed.position[0];
    const ly = ligandAtom.y + placed.position[1];
    const lz = ligandAtom.z + placed.position[2];
    const distance = Math.hypot(proteinAtom.x - lx, proteinAtom.y - ly, proteinAtom.z - lz);

    // Try sidecar; fall back to local geometric stub.
    const sidecarResult = await dockWithSidecar({
      pdbId: protein.pdbId,
      proteinAtomIndex: pendingProteinAtom,
      ligandId: placed.entry.id,
      ligandAtomIndex: atomIndex,
      ligandX: lx, ligandY: ly, ligandZ: lz,
      proteinX: proteinAtom.x, proteinY: proteinAtom.y, proteinZ: proteinAtom.z,
    });

    const result = sidecarResult ?? localGeometricDock(distance);

    const info: BindingInfo = {
      instanceId,
      ligandName: placed.entry.name,
      ligandAtomIndex: atomIndex,
      proteinAtomIndex: pendingProteinAtom,
      distance: result.distanceAngstrom,
      kdNm: result.estimatedKdNm,
      method: result.method,
      notes: result.notes,
    };
    setBinding(info);
    setPendingProteinAtom(null);

    await log.append({
      projectId, mode: 'play', actor: 'user', type: 'play.bind',
      payload: { instanceId, ligandId: placed.entry.id, atomIndex, info },
      timestamp: new Date().toISOString(),
    });

    const variant = session.variant;
    const prediction = session.prediction;
    if (variant && prediction) {
      const cosci = getCoScientist();
      const bindingCtx = {
        ligandName: placed.entry.name,
        ligandFormula: placed.entry.formula,
        distanceAngstrom: result.distanceAngstrom,
        estimatedKdNm: result.estimatedKdNm,
      };
      const obs = await cosci.observe({
        projectId, molecule: session.molecule, variant,
        predictions: [prediction], binding: bindingCtx,
      });
      const hyp = await cosci.hypothesize({
        projectId, molecule: session.molecule, variant,
        predictions: [prediction], binding: bindingCtx,
      });
      await log.append({
        projectId, mode: 'play', actor: 'ai', type: 'ai.hypothesis.generate',
        payload: { hypothesis: hyp, observation: obs, binding: info },
        timestamp: new Date().toISOString(),
      });
      session.setBindingResult(obs, hyp);
    }
    refreshActionCount();
  };

  const handleCut = (atomIndex: number) => {
    setSegments((prev) => {
      const current = prev ?? initialSegment(atomCount);
      setCutCount((c) => c + 1);
      void log.append({
        projectId, mode: 'play', actor: 'user', type: 'play.cut',
        payload: { atomIndex },
        timestamp: new Date().toISOString(),
      }).then(refreshActionCount);
      return cutAt(current, atomIndex);
    });
  };

  const handleToolChange = (t: PlaygroundTool) => {
    setTool(t);
    setMeasureAnchors([]);
    setBindAnchors([]);
    setMeasureDistance(null);
    setPendingProteinAtom(null);
    setPendingLigandInstance(null);
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
          placedLigands={ligands.map((l) => ({
            instanceId: l.instanceId, ligand: l.entry, position: l.position,
          }))}
          onLigandPositionChange={handleLigandPositionChange}
          onLigandDragEnd={handleLigandDragEnd}
          highlightedLigandAtom={highlightedLigandAtom}
          highlightedLigandInstance={pendingLigandInstance}
          onLigandAtomClick={handleLigandAtomClick}
          bindingLink={
            binding
              ? {
                  proteinAtomIndex: binding.proteinAtomIndex,
                  ligandAtomIndex: binding.ligandAtomIndex,
                  ligandInstanceId: binding.instanceId,
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
          {ligands.length > 0 && (
            <> · <span style={{ color: '#66ff88' }}>{ligands.length} ligand{ligands.length === 1 ? '' : 's'} (drag to move)</span></>
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
        <LigandShelf activeId={null} onPick={handleAddLigand} />

        {ligands.length > 0 && (
          <div className="panel">
            <div className="panel-label">Placed ligands</div>
            <div className="placed-list">
              {ligands.map((l) => (
                <div key={l.instanceId} className="placed-item">
                  <span className="placed-name">{l.entry.name}</span>
                  <span className="placed-pos mono">
                    [{l.position[0].toFixed(0)}, {l.position[1].toFixed(0)}, {l.position[2].toFixed(0)}]
                  </span>
                  <button className="placed-remove" onClick={() => handleRemoveLigand(l.instanceId)}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="panel">
          <div className="panel-label">Loaded</div>
          <div className="panel-value">{protein.gene}</div>
          <div className="panel-hint mono">{protein.pdbId} · {atomCount} residues</div>
        </div>

        <div className="panel">
          <div className="panel-label">Active tool</div>
          <div className="panel-value mono">{tool}</div>
          <div className="panel-hint">
            {tool === 'select' && 'Click a residue to pick it, then mutate.'}
            {tool === 'cut' && 'Click a residue to split the chain there.'}
            {tool === 'attach' && 'Click two residues in different fragments to merge.'}
            {tool === 'measure' && 'Click two residues to see the distance.'}
            {tool === 'bind' && (ligands.length > 0
              ? 'Click a protein residue, then a ligand atom.'
              : 'Add a ligand from the shelf first.')}
          </div>
        </div>

        {binding && (
          <div className="panel binding-panel">
            <div className="panel-label">Binding estimate</div>
            <div className="binding-row">
              <span>Ligand</span><span className="mono">{binding.ligandName}</span>
            </div>
            <div className="binding-row">
              <span>Distance</span><span className="mono">{binding.distance.toFixed(2)} Å</span>
            </div>
            <div className="binding-row">
              <span>Estimated Kd</span>
              <span className="mono">
                {binding.kdNm < 1000 ? `${binding.kdNm.toFixed(1)} nM` : `${(binding.kdNm / 1000).toFixed(2)} µM`}
              </span>
            </div>
            <div className="binding-row">
              <span>Method</span><span className="mono" style={{ fontSize: 10 }}>{binding.method}</span>
            </div>
            <div className="stub-note">{binding.notes}</div>
            <button className="zoom-btn" onClick={() => setBinding(null)}>Clear</button>
          </div>
        )}

        <div className="panel">
          <div className="panel-label">AI co-scientist</div>
          <div className="panel-value mono">{aiName}</div>
          {ai.kind === 'checking' && <div className="panel-hint">checking for Ollama…</div>}
          {ai.kind === 'stub' && <div className="panel-hint">Ollama not detected. Using stub.</div>}
          {ai.kind === 'ollama' && <div className="panel-hint">Local LLM: <strong>{ai.model}</strong>.</div>}
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
