import { useCallback, useMemo, useRef, useState } from 'react';
import {
  EventLog,
  newEventLogId,
  newMoleculeId,
  newProjectId,
  type Molecule,
} from '@genesis/shared';
import { FlowCanvas } from '../flow/FlowCanvas';
import { FlowResults } from '../flow/FlowResults';
import {
  runPipeline,
  type PipelineRow,
} from '../flow/runPipeline';

const DEMO_PDB = '4HJO';
const PROTEIN = 'EGFR';

export function FlowTab() {
  const projectId = useMemo(() => newProjectId(), []);
  const logRef = useRef<EventLog | null>(null);
  if (!logRef.current) logRef.current = new EventLog(newEventLogId(), projectId);
  const log = logRef.current;

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
  const [actionCount, setActionCount] = useState(0);
  const [logVerified, setLogVerified] = useState<boolean | null>(null);
  const [lastRunMs, setLastRunMs] = useState<number | null>(null);

  const handleRun = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setRows([]);
    setProgress({ done: 0, total: 0 });
    setLogVerified(null);

    const t0 = performance.now();

    await log.append({
      projectId,
      mode: 'flow',
      actor: 'user',
      type: 'flow.run.start',
      payload: { label: 'EGFR stability pipeline' },
      timestamp: new Date().toISOString(),
    });

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

      setActionCount(log.length);
      setLastRunMs(Math.round(performance.now() - t0));
    } finally {
      setRunning(false);
      setActiveNode(null);
    }
  }, [running, log, projectId, molecule]);

  const handleVerify = useCallback(async () => {
    const ok = await log.verify();
    setLogVerified(ok);
    setActionCount(log.length);
  }, [log]);

  return (
    <div className="flow-layout">
      <div className="flow-main">
        <div className="flow-canvas-wrap">
          <FlowCanvas activeNodeId={activeNode} />
        </div>
        <div className="flow-results-wrap">
          <FlowResults rows={rows} />
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

        <div className="session-footer">
          <div>
            {actionCount} action{actionCount === 1 ? '' : 's'} logged
          </div>
          <button
            className="link"
            disabled={actionCount === 0}
            onClick={handleVerify}
          >
            Verify session
          </button>
          {logVerified !== null && (
            <div className={logVerified ? 'ok' : 'bad'}>
              {logVerified ? '✓ chain intact' : '✗ chain broken'}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
