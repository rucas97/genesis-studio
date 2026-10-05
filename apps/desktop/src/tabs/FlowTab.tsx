import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { newMoleculeId, type Molecule } from '@genesis/shared';
import {
  listStabilityEngines,
  getStabilityEngine,
  tryRegisterSidecar,
} from '@genesis/engines';
import {
  NodeEditor,
  createNode,
  type NodeInstance,
  type EdgeInstance,
} from '../flow/NodeEditor';
import { NodePalette } from '../flow/NodePalette';
import { NodeParamsPanel } from '../flow/NodeParamsPanel';
import { FlowResults } from '../flow/FlowResults';
import { executeGraph, type PipelineRow } from '../flow/graphExecutor';
import { downloadGraph } from '../flow/graphSerialization';
import { autosaveGraph, loadAutosavedGraph } from '../flow/graphStorage';
import { useProject } from '../state/ProjectContext';

const DEMO_PDB = '4HJO';
const PROTEIN = 'EGFR';

type SidecarState =
  | { kind: 'checking' }
  | { kind: 'absent' }
  | { kind: 'stub'; runner: string; version: string }
  | { kind: 'real'; runner: string; version: string };

function buildInitialGraph(): { nodes: NodeInstance[]; edges: EdgeInstance[] } {
  const a = createNode('fetch_pdb', 80, 100);
  const b = createNode('batch_variants', 340, 100);
  const c = createNode('predict_stability', 620, 100);
  const d = createNode('ai_hypothesis', 900, 100);
  const nodes = [a, b, c, d];
  const edges: EdgeInstance[] = [
    { id: 'e1', from: { nodeId: a.id, portId: 'struct' }, to: { nodeId: c.id, portId: 'struct' } },
    { id: 'e2', from: { nodeId: b.id, portId: 'vars' }, to: { nodeId: c.id, portId: 'vars' } },
    { id: 'e3', from: { nodeId: c.id, portId: 'results' }, to: { nodeId: d.id, portId: 'evidence' } },
  ];
  return { nodes, edges };
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

  const initial = useMemo(() => loadAutosavedGraph() ?? buildInitialGraph(), []);
  const [nodes, setNodes] = useState<NodeInstance[]>(initial.nodes);
  const [edges, setEdges] = useState<EdgeInstance[]>(initial.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [activeNodeIds, setActiveNodeIds] = useState<string[]>([]);
  const [lastRunMs, setLastRunMs] = useState<number | null>(null);
  const [engineName, setEngineName] = useState<string>('Stub');
  const [engineVersion, setEngineVersion] = useState<string>('0.0.1');
  const [sidecar, setSidecar] = useState<SidecarState>({ kind: 'checking' });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshEngine = useCallback(() => {
    const e = getStabilityEngine();
    setEngineName(e.name);
    setEngineVersion(e.version);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const health = await tryRegisterSidecar();
      if (cancelled) return;
      if (!health) { setSidecar({ kind: 'absent' }); refreshEngine(); return; }
      if (health.isRealPredictor) setSidecar({ kind: 'real', runner: health.runner, version: health.version });
      else setSidecar({ kind: 'stub', runner: health.runner, version: health.version });
      refreshEngine();
    })();
    return () => { cancelled = true; };
  }, [refreshEngine]);

  useEffect(() => { autosaveGraph(nodes, edges); }, [nodes, edges]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  const handleChange = useCallback((n: NodeInstance[], e: EdgeInstance[]) => {
    setNodes(n);
    setEdges(e);
  }, []);

  const handleAddNode = useCallback((typeKey: string) => {
    const node = createNode(typeKey, 300 + Math.random() * 200, 300 + Math.random() * 100);
    setNodes((n) => [...n, node]);
    setSelectedNodeId(node.id);
  }, []);

  const handleParamChange = useCallback(
    (nodeId: string, key: string, value: unknown) => {
      setNodes((ns) =>
        ns.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, [key]: value } } : n))
      );
    },
    []
  );

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== nodeId));
    setEdges((es) => es.filter((e) => e.from.nodeId !== nodeId && e.to.nodeId !== nodeId));
    setSelectedNodeId(null);
  }, []);

  const handleSave = useCallback(() => {
    downloadGraph(nodes, edges, `genesis-flow-${Date.now()}.json`);
  }, [nodes, edges]);

  const handleLoadClick = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileChosen = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { deserializeGraph } = await import('../flow/graphSerialization');
      const g = deserializeGraph(text);
      setNodes(g.nodes); setEdges(g.edges); setSelectedNodeId(null);
    } catch (err) {
      window.alert(`Could not load graph: ${(err as Error).message}`);
    } finally { e.target.value = ''; }
  }, []);

  const handleExport = useCallback((filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }, []);

  const handleRun = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setRows([]);
    setProgress({ done: 0, total: 0 });

    await log.append({
      projectId, mode: 'flow', actor: 'user',
      type: 'flow.run.start',
      payload: { label: 'EGFR pipeline', nodeCount: nodes.length },
      timestamp: new Date().toISOString(),
    });
    refreshActionCount();

    try {
      const result = await executeGraph(nodes, edges, {
        projectId, molecule,
        onActiveNode: (id) => setActiveNodeIds(id ? [id] : []),
        onProgress: (done, total) => setProgress({ done, total }),
        onExport: handleExport,
      });
      setRows(result.rows);
      setLastRunMs(result.totalMs);
      setEngineName(result.engineName);
      setEngineVersion(result.engineVersion);

      await log.append({
        projectId, mode: 'flow', actor: 'system',
        type: 'flow.run.complete',
        payload: { rows: result.rows.length, engine: result.engineName },
        timestamp: new Date().toISOString(),
      });
      refreshActionCount();
    } catch (e) {
      window.alert(`Pipeline failed: ${(e as Error).message}`);
    } finally {
      setActiveNodeIds([]);
      setRunning(false);
    }
  }, [running, nodes, edges, log, projectId, molecule, refreshActionCount, handleExport]);

  const handleSendToPlay = useCallback(
    (row: PipelineRow) => sendToPlay({ variant: row.variant, molecule }),
    [sendToPlay, molecule]
  );

  const availableEngines = listStabilityEngines().map((e) => e.name);

  return (
    <div className="flow-layout">
      <div className="flow-main">
        <div className="flow-editor-wrap">
          <NodeEditor
            nodes={nodes} edges={edges} onChange={handleChange}
            selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId}
            activeNodeIds={activeNodeIds} onRun={handleRun} running={running}
          />
        </div>
        <div className="flow-results-wrap">
          <FlowResults rows={rows} onSendToPlay={handleSendToPlay} />
        </div>
      </div>

      <aside className="flow-sidebar">
        <NodePalette onAdd={handleAddNode} />

        <NodeParamsPanel node={selectedNode} onChange={handleParamChange} onDelete={handleDeleteNode} />

        <div className="panel">
          <div className="panel-label">Graph</div>
          <div className="panel-value">
            {nodes.length} node{nodes.length === 1 ? '' : 's'} · {edges.length} edge{edges.length === 1 ? '' : 's'}
          </div>
          <div className="graph-buttons">
            <button className="zoom-btn" onClick={handleSave}>Save</button>
            <button className="zoom-btn" onClick={handleLoadClick}>Load</button>
          </div>
          <input
            ref={fileInputRef} type="file" accept="application/json,.json"
            style={{ display: 'none' }} onChange={handleFileChosen}
          />
        </div>

        <div className="panel">
          <div className="panel-label">Engine</div>
          <div className="panel-value mono">{engineName} v{engineVersion}</div>
          <SidecarStatus state={sidecar} />
          <p className="panel-hint mono">registered: {availableEngines.join(', ')}</p>
        </div>

        {running && progress.total > 0 && (
          <div className="panel">
            <div className="panel-label">Progress</div>
            <div className="panel-value mono">{progress.done} / {progress.total}</div>
          </div>
        )}
        {!running && lastRunMs !== null && (
          <div className="panel">
            <div className="panel-label">Last run</div>
            <div className="panel-value mono">{lastRunMs} ms</div>
          </div>
        )}
      </aside>
    </div>
  );
}

function SidecarStatus({ state }: { state: SidecarState }) {
  if (state.kind === 'checking') return <div className="sidecar-status checking">sidecar: checking…</div>;
  if (state.kind === 'absent') {
    return (
      <div className="sidecar-status absent">
        sidecar: absent
        <div className="sidecar-note">
          Start the Python service (<code>python server.py</code>) to enable the sidecar path.
        </div>
      </div>
    );
  }
  if (state.kind === 'stub') {
    return (
      <div className="sidecar-status stub">
        sidecar: connected · {state.runner}
        <div className="sidecar-note">
          Stub runner. Numbers are deterministic placeholders, not science.
        </div>
      </div>
    );
  }
  return (
    <div className="sidecar-status real">
      sidecar: connected · {state.runner}
      <div className="sidecar-note">Real predictions. ThermoMPNN is active.</div>
    </div>
  );
}
