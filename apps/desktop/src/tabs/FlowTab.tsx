import { useCallback, useMemo, useState } from 'react';
import {
  newMoleculeId,
  type Molecule,
} from '@genesis/shared';
import { FlowCanvas } from '../flow/FlowCanvas';
import { FlowResults } from '../flow/FlowResults';
import { runPipeline, type PipelineRow } from '../flow/runPipeline';
import { useProject } from '../state/ProjectContext';

const DEMO_PDB = '4HJO';
const PROTEIN = 'EGFR';

export function FlowTab() {
  const { log, projectId, sendToPlay, refreshActionCount } = useProject();

  const molecule = useMemo<Molecule>(
    () => ({
      id: newMoleculeId(),
      projectId,
      kind: 'protein',
      name: PROTEIN,
      description: `${PROTEIN} · ${DEMO_PDB}`,
      sequence: '',
      structure: { kind: 'pdb', pdbId: DEMO_PDB },
      variantIds: [],
      createdIn: 'flow',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    [projectId]
  );

  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [lastRunMs, setLastRunMs] = useState<number | null>(null);

  const handleRun = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setRows([]);
    setProgress({ done: 0, total: 0 });

    const t0 = performance.now();

    await log.append({
      projectId,
      mode: 'flow',
      actor: 'user',
      type: 'flow.run.start',
      payload: { label: 'EGFR stability pipeline' },
      timestamp: new Date().toISOString(),
    });
    refreshActionCount();

    try {
      const result = await runPipeline({
        projectId,
        molecule,
        onProgress: (done, total) => setProgress({ done, total }),
        onActiveNode: setActiveNode,
      });
      setRows(result.rows);

      await log.append({
        projectId,
        mode: 'flow',
        actor: 'system',
        type: 'flow.run.complete',
        payload: { run: result.run },
        timestamp: new Date().toISOString(),
      });
      refreshActionCount();
      setLastRunMs(Math.round(performance.now() - t0));
    } finally {
      setRunning(false);
      setActiveNode(null);
    }
  }, [running, log, projectId, molecule, refreshActionCount]);

  const handleSendToPlay = useCallback(
    (row: PipelineRow) => {
      sendToPlay({ variant: row.variant, molecule });
    },
    [sendToPlay, molecule]
  );

  return (
    <div className="flow-layout">
      <div className="flow-main">
        <div className="flow-canvas-wrap">
          <FlowCanvas activeNodeId={activeNode} />
        </div>
        <div className="flow-results-wrap">
          <FlowResults rows={rows} onSendToPlay={handleSendToPlay} />
        </div>
      </div>

      <aside className="flow-sidebar">
        <div className="panel">
          <div className="panel-label">Pipeline</div>
          <div className="panel-value">EGFR · 25 variants</div>
          <p className="panel-hint">
            Load EGFR · apply curated variants · predict stability · rank by ΔΔG.
          </p>
          <button
            className="primary"
            disabled={running}
            onClick={handleRun}
          >
            {running ? 'Running…' : 'Run pipeline'}
          </button>
          {running && progress.total > 0 && (
            <div className="flow-progress">
              {progress.done} / {progress.total}
            </div>
          )}
          {!running && lastRunMs !== null && (
            <div className="panel-hint">Last run: {lastRunMs} ms</div>
          )}
        </div>

        <div className="panel">
          <div className="panel-label">Engine</div>
          <div className="panel-value mono">Stub v0.0.1</div>
          <p className="panel-hint">
            Deterministic placeholder. Swapping for ThermoMPNN is a one-line
            change in the engine registry.
          </p>
        </div>

        <div className="panel">
          <div className="panel-label">Bridge</div>
          <p className="panel-hint">
            Click <strong>Send to Play</strong> on any row to open that variant
            in the 3D sandbox with the prediction preloaded.
          </p>
        </div>
      </aside>
    </div>
  );
}
