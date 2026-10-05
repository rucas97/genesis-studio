import { ProteinViewer } from '../scene/ProteinViewer';
import { usePlaySession } from '../state/usePlaySession';
import { ResiduePanel } from '../panels/ResiduePanel';
import { MutationPanel } from '../panels/MutationPanel';
import { AICard } from '../panels/AICard';

const DEMO_PDB = '4HJO';
const PROTEIN = 'EGFR';
const GENE = 'EGFR';

export function PlayTab() {
  const session = usePlaySession({
    pdbId: DEMO_PDB,
    proteinName: PROTEIN,
    geneName: GENE,
  });

  return (
    <div className="play-layout">
      <div className="play-scene">
        <ProteinViewer
          pdbId={DEMO_PDB}
          pickedResidueNumber={session.picked?.residueNumber ?? null}
          mutatedResidueNumber={session.variant?.position ?? null}
          onPickResidue={session.pickResidue}
        />
        <div className="scene-overlay">
          <strong>Play</strong> · {DEMO_PDB} · {PROTEIN} · click a CA sphere to pick a residue
        </div>
      </div>

      <aside className="play-sidebar">
        {!session.picked && (
          <div className="panel">
            <div className="panel-label">Play</div>
            <p className="panel-hint">
              Click any residue in the 3D view to begin. Then choose a new
              amino acid to mutate it.
            </p>
          </div>
        )}

        {session.picked && (
          <ResiduePanel
            residue={session.picked}
            disabled={session.status === 'predicting'}
            onMutate={(aa) => session.mutate(aa)}
          />
        )}

        {session.variant && (
          <MutationPanel variant={session.variant} prediction={session.prediction} />
        )}

        {session.observation && (
          <AICard observation={session.observation} hypothesis={session.hypothesis} />
        )}

        <div className="session-footer">
          <div>
            {session.actionCount} action{session.actionCount === 1 ? '' : 's'} logged
          </div>
          <button
            className="link"
            disabled={session.actionCount === 0}
            onClick={() => session.verifyLog()}
          >
            Verify session
          </button>
          {session.logVerified !== null && (
            <div className={session.logVerified ? 'ok' : 'bad'}>
              {session.logVerified ? '✓ chain intact' : '✗ chain broken'}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
