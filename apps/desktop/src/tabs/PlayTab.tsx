import { useEffect, useMemo, useRef, useState } from 'react';
import { ProteinViewer, type PlaygroundTool } from '../scene/ProteinViewer';
import { usePlaySession, type PickedResidue } from '../state/usePlaySession';
import { ResiduePanel } from '../panels/ResiduePanel';
import { MutationPanel } from '../panels/MutationPanel';
import { AICard } from '../panels/AICard';
import { LiveInspect } from '../panels/LiveInspect';
import { ProteinLibraryPanel } from '../panels/ProteinLibraryPanel';
import { LigandShelf } from '../playground/LigandShelf';
import { ToolBelt } from '../playground/ToolBelt';
import { Inspector, Section } from '../panels/Inspector';
import { SequenceViewer } from '../panels/SequenceViewer';
import { SecondaryStructureLegend } from '../scene/SecondaryStructureLegend';
import { useProject } from '../state/ProjectContext';
import { getProteinById, type ProteinEntry } from '../data/proteinLibrary';
import type { LigandEntry } from '../data/ligandLibrary';
import type { PDBSource, CAAtom } from '../scene/pdbLoader';
import { loadPDB, parsePDBCA, centerAtoms } from '../scene/pdbLoader';
import { listCoScientists, getCoScientist, tryRegisterOllama } from '@genesis/ai';
import { cutAt, initialSegment, mergeSegments, type Segment } from '../scene/segments';
import { dockWithSidecar, localGeometricDock, type DockResult } from '@genesis/engines';

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
  result: DockResult;
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
  const { log, projectId, pendingSendToPlay, clearPendingSendToPlay, refreshActionCount } = useProject();

  const [proteinId, setProteinId] = useState(DEFAULT_PROTEIN);
  const protein = useMemo(
    () => getProteinById(proteinId) ?? getProteinById(DEFAULT_PROTEIN)!,
    [proteinId]
  );

  const session = usePlaySession({
    log, projectId, pdbId: protein.pdbId,
    proteinName: protein.name, geneName: protein.gene,
  });

  const consumedRef = useRef(false);
  const [source, setSource] = useState<PDBSource | null>(null);
  const [ai, setAi] = useState<AIState>({ kind: 'checking' });
  const [atoms, setAtoms] = useState<CAAtom[]>([]);

  const [tool, setTool] = useState<PlaygroundTool>('select');
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [atomCount, setAtomCount] = useState(0);
  const [measureAnchors, setMeasureAnchors] = useState<number[]>([]);
  const [bindAnchors, setBindAnchors] = useState<number[]>([]);
  const [measureDistance, setMeasureDistance] = useState<number | null>(null);
  const [cutCount, setCutCount] = useState(0);

  const [ligands, setLigands] = useState<PlacedLigand[]>([]);
  const [pendingProteinAtom, setPendingProteinAtom] = useState<number | null>(null);
  const [pendingLigandInstance, setPendingLigandInstance] = useState<string | null>(null);
  const [highlightedLigandAtom, setHighlightedLigandAtom] = useState<number | null>(null);
  const [binding, setBinding] = useState<BindingInfo | null>(null);
  const [docking, setDocking] = useState(false);
  const [selectedLigandInstance, setSelectedLigandInstance] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const keyClearTimerRef = useRef<number | null>(null);
  const [anchor, setAnchor] = useState<{
    atomIndex: number;
    position: [number, number, number];
    color: number;
  } | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: 'ok' | 'err' | 'info';
    message: string;
  } | null>(null);

  const atomCoordsRef = useRef<Map<number, { x: number; y: number; z: number }>>(new Map());
  const lastLoggedProteinRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;
    loadPDB(protein.pdbId)
      .then(({ text }) => {
        if (cancelled) return;
        setAtoms(centerAtoms(parsePDBCA(text)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [protein.pdbId]);

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
    void session.bridgeIn(payload.variant, payload.molecule).then(refreshActionCount);
  }, [pendingSendToPlay, clearPendingSendToPlay, session, refreshActionCount]);

  const flash = (kind: 'ok' | 'err' | 'info', message: string, ms = 1800) => {
    setFeedback({ kind, message });
    window.setTimeout(() => {
      setFeedback((f) => (f && f.kind === kind && f.message === message ? null : f));
    }, ms);
  };

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
    const pos: [number, number, number] = [picked.atom.x, picked.atom.y, picked.atom.z];

    if (tool === 'cut') {
      handleCut(picked.index);
      flash('ok', `Cut at ${picked.residueOneLetter}${picked.residueNumber}`);
      return;
    }

    if (tool === 'measure') {
      if (!anchor) {
        setAnchor({ atomIndex: picked.index, position: pos, color: 0xffaa00 });
        flash('info', `Anchor: ${picked.residueOneLetter}${picked.residueNumber} — click the second residue`);
      } else {
        const a = atomCoordsRef.current.get(anchor.atomIndex);
        const b = picked.atom;
        if (a) {
          const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
          setMeasureDistance(d);
          setAnchor(null);
          flash('ok', `Distance: ${d.toFixed(2)} Å`);
        }
      }
      return;
    }

    if (tool === 'attach') {
      if (!anchor) {
        setAnchor({ atomIndex: picked.index, position: pos, color: 0xcc88ff });
        flash('info', 'Click a residue on a different fragment');
        return;
      }
      if (!segments || segments.length < 2) {
        flash('err', 'Cut the chain first to create fragments');
        return;
      }
      const findSeg = (idx: number) =>
        segments.findIndex((seg) => idx >= seg.start && idx < seg.end);
      const aSeg = findSeg(anchor.atomIndex);
      const bSeg = findSeg(picked.index);
      if (aSeg < 0 || bSeg < 0) {
        flash('err', 'Could not locate fragments');
        return;
      }
      if (aSeg === bSeg) {
        flash('err', 'Both residues are in the same fragment');
        return;
      }
      setSegments(mergeSegments(segments, anchor.atomIndex, picked.index));
      setAnchor(null);
      flash('ok', 'Fragments merged');
      return;
    }

    if (tool === 'bind') {
      // Set / update the anchor. The user must click a ligand atom next.
      setAnchor({ atomIndex: picked.index, position: pos, color: 0x66ff88 });
      setPendingProteinAtom(picked.index);
      setHighlightedLigandAtom(null);
      flash('info', `Anchor: ${picked.residueOneLetter}${picked.residueNumber} — click a ligand atom`);
      return;
    }
  };

  const handleAddLigand = (entry: LigandEntry) => {
    const offset = 40 + ligands.length * 18;
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
    setSelectedLigandInstance((cur) => (cur === instanceId ? null : cur));
    setBinding((b) => (b && b.instanceId === instanceId ? null : b));
    void log.append({
      projectId, mode: 'play', actor: 'user', type: 'play.remove_ligand',
      payload: { instanceId }, timestamp: new Date().toISOString(),
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

  const handleDockNow = async () => {
    if (pendingProteinAtom === null || !pendingLigandInstance) return;
    await runDock(pendingLigandInstance, highlightedLigandAtom ?? 0);
  };

  const runDock = async (ligandInstanceId: string, ligandAtomIndex: number) => {
    if (pendingProteinAtom === null) {
      flash('err', 'Click a protein residue first');
      return;
    }
    const placed = ligands.find((l) => l.instanceId === ligandInstanceId);
    if (!placed) return;
    const proteinAtom = atomCoordsRef.current.get(pendingProteinAtom);
    if (!proteinAtom) {
      flash('err', 'Could not locate the anchored protein residue');
      return;
    }

    setDocking(true);
    try {
      const ligandPoint = { x: placed.position[0], y: placed.position[1], z: placed.position[2] };
      const sidecarResult = await dockWithSidecar({
        pdbId: protein.pdbId,
        ligandId: placed.entry.id,
        ligandSmiles: placed.entry.smiles,
        center: proteinAtom,
        boxSize: 22,
        ligandPoint,
      });

      let result: DockResult;
      if (sidecarResult) {
        result = sidecarResult;
      } else {
        const distance = Math.hypot(
          proteinAtom.x - ligandPoint.x,
          proteinAtom.y - ligandPoint.y,
          proteinAtom.z - ligandPoint.z,
        );
        result = localGeometricDock(distance);
      }

      const info: BindingInfo = {
        instanceId: placed.instanceId,
        ligandName: placed.entry.name,
        ligandAtomIndex: 0,
        proteinAtomIndex: pendingProteinAtom,
        result,
      };
      setBinding(info);

      await log.append({
        projectId, mode: 'play', actor: 'user', type: 'play.bind',
        payload: { instanceId: placed.instanceId, ligandId: placed.entry.id, info },
        timestamp: new Date().toISOString(),
      });

      const variant = session.variant;
      const prediction = session.prediction;
      if (variant && prediction) {
        const cosci = getCoScientist();
        const bindingCtx = {
          ligandName: placed.entry.name,
          ligandFormula: placed.entry.formula,
          distanceAngstrom: result.distanceAngstrom ?? 0,
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
    } finally {
      setDocking(false);
    }
  };

  const handleLigandAtomClick = async (instanceId: string, atomIndex: number) => {
    setSelectedLigandInstance(instanceId);
    setPendingLigandInstance(instanceId);
    setHighlightedLigandAtom(atomIndex);

    if (tool === 'bind') {
      if (pendingProteinAtom === null) {
        flash('err', 'Click a protein residue first');
        return;
      }
      await runDock(instanceId, atomIndex);
    }
  };

  const handleCut = (atomIndex: number) => {
    setSegments((prev) => {
      const current = prev ?? initialSegment(atomCount);
      setCutCount((c) => c + 1);
      void log.append({
        projectId, mode: 'play', actor: 'user', type: 'play.cut',
        payload: { atomIndex }, timestamp: new Date().toISOString(),
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
    setAnchor(null);
    setFeedback(null);
  };

  // Esc: full cancel. Returns to Select and clears all selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.key === 'Escape') {
        setTool('select');
        setAnchor(null);
        setFeedback(null);
        setPendingProteinAtom(null);
        setPendingLigandInstance(null);
        setHighlightedLigandAtom(null);
        setSelectedLigandInstance(null);
        setMeasureAnchors([]);
        setBindAnchors([]);
        setMeasureDistance(null);
        session.pickResidue(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session]);

  // Live keypress indicator for the inspect overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

      let display: string | null = null;
      if (e.key.length === 1) display = e.key.toUpperCase();
      else if (e.key === 'Escape') display = 'ESC';
      else if (e.key === 'Delete') display = 'DEL';
      else if (e.key === 'Backspace') display = '\u232B';

      if (!display) return;

      setLastKey(display);
      if (keyClearTimerRef.current !== null) {
        window.clearTimeout(keyClearTimerRef.current);
      }
      keyClearTimerRef.current = window.setTimeout(() => {
        setLastKey(null);
        keyClearTimerRef.current = null;
      }, 1400);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (keyClearTimerRef.current !== null) {
        window.clearTimeout(keyClearTimerRef.current);
      }
    };
  }, []);

  const handleSequenceClick = (index: number) => {
    const a = atoms[index];
    if (!a) return;
    handlePickResidue({
      index, residueNumber: a.residueNumber,
      residueOneLetter: a.residueOneLetter,
      atom: { x: a.x, y: a.y, z: a.z },
    });
  };

  // Delete key removes the currently selected ligand.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLigandInstance) {
        e.preventDefault();
        handleRemoveLigand(selectedLigandInstance);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedLigandInstance]);

  const aiName = getCoScientist().name;

  const inputTab = (
    <>
      <Section title="Protein library" count={15} defaultOpen>
        <ProteinLibraryPanel currentId={proteinId} onPick={handlePickProtein} />
      </Section>
      <Section title="Ligand shelf" count={5} defaultOpen>
        <LigandShelf activeId={null} onPick={handleAddLigand} />
      </Section>
      {ligands.length > 0 && (
        <Section title="Placed" count={ligands.length} defaultOpen>
          <div className="placed-list">
            {ligands.map((l) => (
              <div key={l.instanceId} className="placed-item">
                <span className="placed-name">{l.entry.name}</span>
                <span className="placed-pos mono">
                  [{l.position[0].toFixed(0)},{l.position[1].toFixed(0)},{l.position[2].toFixed(0)}]
                </span>
                <button className="placed-remove" onClick={() => handleRemoveLigand(l.instanceId)}>x</button>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );

  const inspectTab = (
    <>
      <Section title="Active tool" defaultOpen>
        <div className="kv">
          <span className="kv-key">tool</span>
          <span className="kv-val mono">{tool}</span>
        </div>
        <div className="hint-text">
          {tool === 'select' && 'Click a residue to pick it.'}
          {tool === 'cut' && 'Click a residue to split the chain.'}
          {tool === 'attach' && 'Click two residues to merge.'}
          {tool === 'measure' && 'Click two residues to measure.'}
          {tool === 'bind' && 'Click a protein residue, then a ligand to dock.'}
        </div>
      </Section>

      {session.picked && (
        <Section title="Selected residue" defaultOpen>
          <SequenceViewer
            atoms={atoms}
            pickedIndex={session.picked.index >= 0 ? session.picked.index : null}
            mutatedResidueNumber={session.variant?.position ?? null}
            onResidueClick={handleSequenceClick}
          />
          <ResiduePanel
            residue={session.picked}
            disabled={session.status === 'predicting'}
            onMutate={(aa) => { void session.mutate(aa).then(refreshActionCount); }}
          />
        </Section>
      )}

      {session.variant && (
        <Section title="Mutation" defaultOpen>
          <MutationPanel variant={session.variant} prediction={session.prediction} />
        </Section>
      )}

      {tool === 'bind' && (
        <Section title="Docking" defaultOpen>
          <div className="kv">
            <span className="kv-key">protein atom</span>
            <span className="kv-val mono">
              {pendingProteinAtom !== null ? `#${pendingProteinAtom}` : '-'}
            </span>
          </div>
          <div className="kv">
            <span className="kv-key">ligand</span>
            <span className="kv-val mono">
              {pendingLigandInstance
                ? ligands.find((l) => l.instanceId === pendingLigandInstance)?.entry.name ?? '-'
                : '-'}
            </span>
          </div>
          <button
            className="primary"
            disabled={pendingProteinAtom === null || !pendingLigandInstance || docking}
            onClick={handleDockNow}
          >
            {docking ? 'Docking...' : 'Run docking'}
          </button>
        </Section>
      )}

      {binding && (
        <Section title="Docking result" defaultOpen accent="#88ff88">
          <div className="kv">
            <span className="kv-key">ligand</span>
            <span className="kv-val mono">{binding.ligandName}</span>
          </div>
          {binding.result.bindingEnergyKcal !== null && (
            <div className="kv">
              <span className="kv-key">dG</span>
              <span className="kv-val mono bad">{binding.result.bindingEnergyKcal.toFixed(2)} kcal/mol</span>
            </div>
          )}
          {binding.result.distanceAngstrom !== null && (
            <div className="kv">
              <span className="kv-key">distance</span>
              <span className="kv-val mono">{binding.result.distanceAngstrom.toFixed(2)} A</span>
            </div>
          )}
          <div className="kv">
            <span className="kv-key">Kd</span>
            <span className="kv-val mono good">
              {binding.result.estimatedKdNm < 1000
                ? `${binding.result.estimatedKdNm.toFixed(1)} nM`
                : `${(binding.result.estimatedKdNm / 1000).toFixed(2)} uM`}
            </span>
          </div>
          <div className="kv">
            <span className="kv-key">method</span>
            <span className="kv-val mono small">{binding.result.method}</span>
          </div>
          <div className="stub-note">{binding.result.notes}</div>
        </Section>
      )}

      {measureDistance !== null && (
        <Section title="Measurement" defaultOpen accent="#ffaa00">
          <div className="kv">
            <span className="kv-key">distance</span>
            <span className="kv-val mono">{measureDistance.toFixed(2)} A</span>
          </div>
        </Section>
      )}
    </>
  );

  const aiTab = (
    <>
      <Section title="Co-scientist" defaultOpen>
        <div className="kv">
          <span className="kv-key">active</span>
          <span className="kv-val mono small">{aiName}</span>
        </div>
        {ai.kind === 'checking' && <div className="hint-text">checking for Ollama...</div>}
        {ai.kind === 'stub' && <div className="hint-text">Ollama not detected. Using stub.</div>}
        {ai.kind === 'ollama' && <div className="hint-text">Local LLM: {ai.model}</div>}
        <div className="hint-text mono small">
          registered: {listCoScientists().map((c) => c.name).join(', ')}
        </div>
      </Section>

      <Section title="Observation" defaultOpen>
        {session.observation ? (
          <AICard observation={session.observation} hypothesis={session.hypothesis} />
        ) : (
          <div className="hint-text">Mutate a residue to generate a hypothesis.</div>
        )}
      </Section>
    </>
  );

  return (
    <div className="play-layout">
      <div className="play-scene">
        <ProteinViewer
          pdbId={protein.pdbId}
          pickedResidueNumber={session.picked?.residueNumber ?? null}
          mutatedResidueNumber={session.variant?.position ?? null}
          onPickResidue={handlePickResidue}
          onBackgroundClick={() => {
            session.pickResidue(null);
            setSelectedLigandInstance(null);
            setPendingLigandInstance(null);
            setHighlightedLigandAtom(null);
            setAnchor(null);
            setPendingProteinAtom(null);
            setFeedback(null);
          }}
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
          selectedLigandInstance={selectedLigandInstance}
          pendingAnchor={anchor ? { position: anchor.position, color: anchor.color } : null}
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
          {source === 'local' ? 'local cache' : source === 'rcsb' ? 'RCSB (online)' : '...'}
          {segments && segments.length > 1 && (
            <> · <span style={{ color: '#ffaa44' }}>{segments.length} fragments · {cutCount} cuts</span></>
          )}
          {ligands.length > 0 && (
            <> · <span style={{ color: '#66ff88' }}>{ligands.length} ligand{ligands.length === 1 ? '' : 's'}</span></>
          )}
        </div>
        <LiveInspect
          tool={tool}
          residueLabel={
            session.picked
              ? `${session.picked.residueOneLetter}${session.picked.residueNumber}`
              : null
          }
          ligandName={
            selectedLigandInstance
              ? ligands.find((l) => l.instanceId === selectedLigandInstance)?.entry.name ?? null
              : null
          }
          lastKey={lastKey}
          hint={
            tool === 'select' ? 'Click a residue to pick it. Drag empty space to orbit.'
            : tool === 'cut' ? 'Click a residue to split the chain there.'
            : tool === 'attach' ? (anchor ? 'Click a residue on a different fragment.' : 'Click the first residue.')
            : tool === 'measure' ? (anchor ? 'Click the second residue.' : 'Click the first residue.')
            : tool === 'bind' ? (anchor ? 'Click a ligand atom to dock.' : 'Click a protein residue.')
            : null
          }
          measureDistance={measureDistance}
          fragmentCount={segments?.length ?? null}
          feedback={feedback}
          onClearMeasure={() => { setMeasureAnchors([]); setMeasureDistance(null); }}
          onResetSegments={() => { setSegments(null); setCutCount(0); }}
        />
        <SecondaryStructureLegend />
        <ToolBelt
          tool={tool}
          onToolChange={handleToolChange}
          measureDistance={measureDistance}
          onClearMeasure={() => { setMeasureAnchors([]); setMeasureDistance(null); }}
          segmentCount={segments?.length}
          onResetSegments={() => { setSegments(null); setCutCount(0); }}
        />
        {selectedLigandInstance && (() => {
          const sel = ligands.find((l) => l.instanceId === selectedLigandInstance);
          if (!sel) return null;
          return (
            <div className="ligand-selected-panel">
              <span className="ligand-selected-name">{sel.entry.name}</span>
              <span className="ligand-selected-hint">
                drag to move | press Delete to remove
              </span>
              <button
                className="ligand-selected-delete"
                onClick={() => handleRemoveLigand(sel.instanceId)}
                title="Remove ligand"
              >x</button>
            </div>
          );
        })()}
      </div>

      <Inspector input={inputTab} inspect={inspectTab} ai={aiTab} />
    </div>
  );
}
