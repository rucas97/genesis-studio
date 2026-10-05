import { useEffect, useMemo, useRef, useState } from 'react';
import { ProteinViewer, type PlaygroundTool } from '../scene/ProteinViewer';
import { usePlaySession, type PickedResidue } from '../state/usePlaySession';
import { ResiduePanel } from '../panels/ResiduePanel';
import { MutationPanel } from '../panels/MutationPanel';
import { AICard } from '../panels/AICard';
import { ProteinLibraryPanel } from '../panels/ProteinLibraryPanel';
import { ToolBelt } from '../playground/ToolBelt';
import { useProject } from '../state/ProjectContext';
import { getProteinById, type ProteinEntry } from '../data/proteinLibrary';
import type { PDBSource } from '../scene/pdbLoader';
import {
  listCoScientists,
  getCoScientist,
  tryRegisterOllama,
} from '@genesis/ai';
import { cutAt, initialSegment, mergeSegments, type Segment } from '../scene/segments';

const DEFAULT_PROTEIN = 'egfr';

type AIState =
  | { kind: 'checking' }
  | { kind: 'stub' }
  | { kind: 'ollama'; model: string; baseUrl: string };

export function PlayTab() {
  const {
    log,
    projectId,
    pendingSendToPlay,
    clearPendingSendToPlay,
    refreshActionCount,
  } = useProject();

  const [proteinId, setProteinId] = useState(DEFAULT_PROTEIN);
  const protein = useMemo(
    () => getProteinById(proteinId) ?? getProteinById(DEFAULT_PROTEIN)!,
    [proteinId]
  );

  const session = usePlaySession({
    log,
    projectId,
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
  const [measureAnchors, setMeasureAnchors] = useState<number[]>([]);
  const [bindAnchors, setBindAnchors] = useState<number[]>([]);
  const [measureDistance, setMeasureDistance] = useState<number | null>(null);

  const atomCoordsRef = useRef<Map<number, { x: number; y: number; z: number }>>(
    new Map()
  );

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
    consumedRef.current = false;
  };

  const handlePickResidue = (picked: PickedResidue | null) => {
    if (tool === 'select') {
      session.pickResidue(picked);
      return;
    }
    if (!picked) return;
    // Record coordinates for distance measurement.
    atomCoordsRef.current.set(picked.index, picked.atom);

    if (tool === 'measure') {
      setMeasureAnchors((prev) => {
        const next = prev.length >= 2 ? [picked.index] : [...prev, picked.index];
        if (next.length === 2) {
          const a = atomCoordsRef.current.get(next[0]);
          const b = atomCoordsRef.current.get(next[1]);
          if (a && b) {
            const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
            setMeasureDistance(d);
          }
        } else {
          setMeasureDistance(null);
        }
        return next;
      });
      return;
    }
    if (tool === 'bind') {
      setBindAnchors((prev) => (prev.length >= 2 ? [picked.index] : [...prev, picked.index]));
      return;
    }
    if (tool === 'attach') {
      setBindAnchors((prev) => {
        const next = prev.length >= 2 ? [picked.index] : [...prev, picked.index];
        if (next.length === 2 && segments) {
          setSegments(mergeSegments(segments, next[0], next[1]));
          setBindAnchors([]);
          return [];
        }
        return next;
      });
      return;
    }
  };

  const handleCut = (atomIndex: number) => {
    setSegments((prev) => {
      const base = prev ?? null;
      const current = base ?? initialSegment(1000);
      if (!base) return null;
      return cutAt(current, atomIndex);
    });
  };

  const handleToolChange = (t: PlaygroundTool) => {
    setTool(t);
    setMeasureAnchors([]);
    setBindAnchors([]);
    setMeasureDistance(null);
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
          tool={tool}
          segments={segments ?? undefined}
          onCut={handleCut}
          measureAnchors={measureAnchors}
          bindAnchors={bindAnchors}
        />
        <div className="scene-overlay">
          <strong>Play</strong> · {protein.pdbId} · {protein.gene} ·{' '}
          {source === 'local' ? 'local cache' : source === 'rcsb' ? 'RCSB (online)' : '…'}
        </div>
        <ToolBelt
          tool={tool}
          onToolChange={handleToolChange}
          measureDistance={measureDistance}
          onClearMeasure={() => {
            setMeasureAnchors([]);
            setMeasureDistance(null);
          }}
          segmentCount={segments?.length}
          onResetSegments={() => setSegments(null)}
        />
      </div>

      <aside className="play-sidebar">
        <ProteinLibraryPanel currentId={proteinId} onPick={handlePickProtein} />

        <div className="panel">
          <div className="panel-label">Loaded</div>
          <div className="panel-value">{protein.gene}</div>
          <div className="panel-hint">{protein.name}</div>
          <div className="panel-hint mono">{protein.pdbId}</div>
          <div className="panel-hint"><em>{protein.why}</em></div>
        </div>

        <div className="panel">
          <div className="panel-label">AI co-scientist</div>
          <div className="panel-value mono">{aiName}</div>
          {ai.kind === 'checking' && <div className="panel-hint">checking for Ollama…</div>}
          {ai.kind === 'stub' && (
            <div className="panel-hint">
              Ollama not detected. Using the stub. Install Ollama from
              ollama.com, run <code>ollama pull llama3.1</code>, then reload.
            </div>
          )}
          {ai.kind === 'ollama' && (
            <div className="panel-hint">
              Local LLM. Model: <strong>{ai.model}</strong>. Runs on this
              machine. Output is not calibrated — verify.
            </div>
          )}
          <div className="panel-hint mono">registered: {registered.join(', ')}</div>
        </div>

        {!session.picked && !pendingSendToPlay && tool === 'select' && (
          <div className="panel">
            <div className="panel-label">Play</div>
            <p className="panel-hint">
              Click a residue to mutate it. Use the tool belt below the
              viewer to cut, attach, measure, or bind.
            </p>
          </div>
        )}

        {session.picked && tool === 'select' && (
          <ResiduePanel
            residue={session.picked}
            disabled={session.status === 'predicting'}
            onMutate={(aa) => {
              void session.mutate(aa).then(refreshActionCount);
            }}
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
