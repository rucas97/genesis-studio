import { useEffect, useRef, useState } from 'react';
import { ProteinViewer } from '../scene/ProteinViewer';
import { usePlaySession, type PickedResidue } from '../state/usePlaySession';
import { ResiduePanel } from '../panels/ResiduePanel';
import { MutationPanel } from '../panels/MutationPanel';
import { AICard } from '../panels/AICard';
import { useProject } from '../state/ProjectContext';
import type { PDBSource } from '../scene/pdbLoader';

const DEMO_PDB = '4HJO';
const PROTEIN = 'EGFR';
const GENE = 'EGFR';

export function PlayTab() {
  const {
    log,
    projectId,
    pendingSendToPlay,
    clearPendingSendToPlay,
    refreshActionCount,
  } = useProject();

  const session = usePlaySession({
    log,
    projectId,
    pdbId: DEMO_PDB,
    proteinName: PROTEIN,
    geneName: GENE,
  });

  const consumedRef = useRef(false);
  const [source, setSource] = useState<PDBSource | null>(null);

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

  return (
    <div className="play-layout">
      <div className="play-scene">
        <ProteinViewer
          pdbId={DEMO_PDB}
          pickedResidueNumber={session.picked?.residueNumber ?? null}
          mutatedResidueNumber={session.variant?.position ?? null}
          onPickResidue={(p) => session.pickResidue(p)}
          onSourceKnown={setSource}
        />
        <div className="scene-overlay">
          <strong>Play</strong> · {DEMO_PDB} · {PROTEIN} ·{' '}
          {source === 'local' ? 'local cache' : source === 'rcsb' ? 'RCSB (online)' : '…'}{' '}
          · click a CA sphere to pick a residue
        </div>
      </div>

      <aside className="play-sidebar">
        {pendingSendToPlay && (
          <div className="panel bridge-panel">
            <div className="panel-label">Bridged from Flow</div>
            <p className="panel-hint">Loading…</p>
          </div>
        )}

        {!session.picked && !pendingSendToPlay && (
          <div className="panel">
            <div className="panel-label">Play</div>
            <p className="panel-hint">
              Click any residue in the 3D view to begin. Then choose a new
              amino acid to mutate it. Or send a variant here from the Flow tab.
            </p>
          </div>
        )}

        {session.picked && (
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
