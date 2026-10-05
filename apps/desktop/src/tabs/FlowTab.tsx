import { useCallback, useMemo, useState } from 'react';
import { newMoleculeId, type Molecule } from '@genesis/shared';
import {
  NodeEditor,
  createNode,
  NODE_WIDTH,
  HEADER_HEIGHT,
  type NodeInstance,
  type EdgeInstance,
} from '../flow/NodeEditor';
import { NodePalette } from '../flow/NodePalette';
import { FlowResults } from '../flow/FlowResults';
import { runPipeline, type PipelineRow } from '../flow/runPipeline';
import { useProject } from '../state/ProjectContext';

const DEMO_PDB = '4HJO';
const PROTEIN = 'EGFR';

function buildInitialGraph(): { nodes: NodeInstance[]; edges: EdgeInstance[] } {
  const a = createNode('fetch_pdb', 80, 100);
  const b = createNode('predict_stability', 360, 100);
  const c = createNode('ai_hypothesis', 640, 100);
  const d = createNode('export', 900, 100);
  const nodes = [a, b, c, d];
  const edges: EdgeInstance[] = [
    {
      id: 'e_init_1',
      from: { nodeId: a.id, portId: 'struct' },
      to: { nodeId: b.id, portId: 'struct' },
    },
    {
      id: 'e_init_2',
      from: { nodeId: b.id, portId: 'results' },
      to: { nodeId: c.id, portId: 'evidence' },
    },
    {
      id: 'e_init_3',
      from: { nodeId: c.id, portId: 'hyp' },
      to: { nodeId: d.id, portId: 'in' },
    },
  ];
  return { nodes, edges };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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

  const initial = useMemo(buildInitialGraph, []);
  const [nodes, setNodes] = useState<NodeInstance[]>(initial.nodes);
  const [edges, setEdges] = useState<EdgeInstance[]>(initial.edges);

  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [activeNodeIds, setActiveNodeIds] = useState<string[]>([]);
  const [lastRunMs, setLastRunMs] = useState<number | null>(null);

  const handleAddNode = useCallback(
    (typeKey: string) => {
      const node = createNode(
        typeKey,
        200 + Math.random() * 200,
        260 + Math.random() * 100
      );
      setNodes((n) => [...n, node]);
    },
    []
  );

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
      payload: { label: 'EGFR pipeline' },
      timestamp: new Date().toISOString(),
    });
    refreshActionCount();

    try {
      // Highlight nodes in topological order (approximated by x position).
      const order = [...nodes].sort((a, b) => a.x - b.x);
      for (const n of order) {
        setActiveNodeIds([n.id]);
        await sleep(220);
      }

      const hasPredict = order.some((n) => n.type === 'predict_stability');
      if (hasPredict) {
        const result = await runPipeline({
          projectId,
          molecule,
          onProgress: (done, total) => setProgress({ done, total }),
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
      }

      setLastRunMs(Math.round(performance.now() - t0));
      refreshActionCount();
    } finally {
      setActiveNodeIds([]);
      setRunning(false);
    }
  }, [running, nodes, log, projectId, molecule, refreshActionCount]);

  const handleSendToPlay = useCallback(
    (row: PipelineRow) => {
      sendToPlay({ variant: row.variant, molecule });
    },
    [sendToPlay, molecule]
  );

  const predictNode = nodes.find((n) => n.type === 'predict_stability');

  return (
    <div className="flow-layout">
      <div className="flow-main">
        <div className="flow-editor-wrap">
          <NodeEditor
            nodes={nodes}
            edges={edges}
            onChange={(n, e) => {
              setNodes(n);
              setEdges(e);
            }}
            activeNodeIds={activeNodeIds}
            onRun={handleRun}
            running={running}
          />
        </div>
        <div className="flow-results-wrap">
          <FlowResults rows={rows} onSendToPlay={handleSendToPlay} />
        </div>
      </div>

      <aside className="flow-sidebar">
        <NodePalette onAdd={handleAddNode} />

        <div className="panel">
          <div className="panel-label">Pipeline</div>
          <div className="panel-value">
            {nodes.length} node{nodes.length === 1 ? '' : 's'} · {edges.length} edge
            {edges.length === 1 ? '' : 's'}
          </div>
          <p className="panel-hint">
            {predictNode
              ? 'Predict stability is present. Run will execute the stub engine over 25 curated EGFR variants.'
              : 'No Predict stability node. Run will only animate the graph.'}
          </p>
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
          <div className="panel-label">Editor</div>
          <ul className="shortcuts">
            <li>Drag a node to move it</li>
            <li>Drag from a port to another port to connect</li>
            <li>Click an edge to delete it</li>
            <li>Select a node, press Delete to remove</li>
            <li>Scroll to zoom, drag empty space to pan</li>
            <li>Drag a node type from the palette into the canvas</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

// Silence unused warnings for exports that may be needed later.
void NODE_WIDTH;
void HEADER_HEIGHT;
