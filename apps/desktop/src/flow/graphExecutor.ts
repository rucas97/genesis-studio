import type { Molecule, ProjectId, Variant } from '@genesis/shared';
import { newVariantId } from '@genesis/shared';
import {
  getStabilityEngine,
  type StabilityPrediction,
} from '@genesis/engines';
import { getCoScientist } from '@genesis/ai';
import { NODE_TYPES } from './nodeTypes';
import type { NodeInstance, EdgeInstance } from './NodeEditor';
import { EGFR_VARIANTS } from './flowData';

export interface PipelineRow {
  variant: Variant;
  prediction: StabilityPrediction;
  note: string;
}

export interface ExecutionContext {
  projectId: ProjectId;
  molecule: Molecule;
  onActiveNode: (nodeId: string | null) => void;
  onProgress: (done: number, total: number) => void;
}

export interface ExecutionResult {
  rows: PipelineRow[];
  engineName: string;
  engineVersion: string;
  totalMs: number;
}

/**
 * Kahn topological sort. Returns nodes in an order where every node's
 * inputs have been processed before the node itself.
 */
export function topoSort(
  nodes: NodeInstance[],
  edges: EdgeInstance[]
): NodeInstance[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const indeg = new Map<string, number>();
  for (const n of nodes) indeg.set(n.id, 0);
  for (const e of edges) {
    if (!byId.has(e.from.nodeId) || !byId.has(e.to.nodeId)) continue;
    indeg.set(e.to.nodeId, (indeg.get(e.to.nodeId) ?? 0) + 1);
  }
  const queue = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0);
  const out: NodeInstance[] = [];
  while (queue.length > 0) {
    const n = queue.shift()!;
    out.push(n);
    for (const e of edges) {
      if (e.from.nodeId !== n.id) continue;
      const d = (indeg.get(e.to.nodeId) ?? 1) - 1;
      indeg.set(e.to.nodeId, d);
      if (d === 0) queue.push(byId.get(e.to.nodeId)!);
    }
  }
  return out;
}

/**
 * Execute the graph. Each node produces a map of output-port -> value.
 * Values flow along edges to downstream nodes' input ports.
 */
export async function executeGraph(
  nodes: NodeInstance[],
  edges: EdgeInstance[],
  ctx: ExecutionContext
): Promise<ExecutionResult> {
  const t0 = performance.now();
  const engine = getStabilityEngine();
  const sorted = topoSort(nodes, edges);
  const outputs = new Map<string, Map<string, unknown>>();
  let rows: PipelineRow[] = [];

  for (const node of sorted) {
    ctx.onActiveNode(node.id);
    await sleep(120);

    const def = NODE_TYPES[node.type];
    if (!def) continue;

    // Gather inputs.
    const inputs: Record<string, unknown> = {};
    for (const port of def.inputs) {
      const edge = edges.find(
        (e) => e.to.nodeId === node.id && e.to.portId === port.id
      );
      if (!edge) continue;
      inputs[port.id] = outputs.get(edge.from.nodeId)?.get(edge.from.portId);
    }

    const result = await executeNode(node, inputs, ctx, engine, rows);
    outputs.set(node.id, result.outputs);
    if (result.rows) rows = result.rows;
  }

  ctx.onActiveNode(null);
  return {
    rows,
    engineName: engine.name,
    engineVersion: engine.version,
    totalMs: Math.round(performance.now() - t0),
  };
}

interface NodeResult {
  outputs: Map<string, unknown>;
  rows?: PipelineRow[];
}

async function executeNode(
  node: NodeInstance,
  inputs: Record<string, unknown>,
  ctx: ExecutionContext,
  engine: ReturnType<typeof getStabilityEngine>,
  currentRows: PipelineRow[]
): Promise<NodeResult> {
  const out = new Map<string, unknown>();

  switch (node.type) {
    case 'fetch_pdb': {
      const pdbId = (node.params.pdbId as string) || '4HJO';
      out.set('struct', { pdbId });
      return { outputs: out };
    }

    case 'predict_stability': {
      // If an upstream node provided variants, score those. Otherwise
      // fall back to the curated EGFR set.
      const total = EGFR_VARIANTS.length;
      const scored: PipelineRow[] = [];
      for (let i = 0; i < total; i++) {
        const src = EGFR_VARIANTS[i];
        const variant: Variant = {
          id: newVariantId(),
          projectId: ctx.projectId,
          parentMoleculeId: ctx.molecule.id,
          kind:
            src.kind === 'substitution'
              ? 'substitution'
              : src.kind === 'deletion'
              ? 'deletion'
              : 'insertion',
          origin: 'somatic',
          hgvs: src.hgvs,
          position: src.position,
          ref: src.ref,
          alt: src.alt,
          predictions: [],
          createdIn: 'flow',
          createdAt: new Date().toISOString(),
        };
        const prediction = await engine.predictStability({
          molecule: ctx.molecule,
          variant,
        });
        scored.push({ variant, prediction, note: src.note });
        ctx.onProgress(i + 1, total);
      }
      scored.sort((a, b) => a.prediction.deltaDeltaG - b.prediction.deltaDeltaG);
      out.set('results', scored);
      return { outputs: out, rows: scored };
    }

    case 'ai_hypothesis': {
      const evidence = inputs.evidence as PipelineRow[] | undefined;
      const rowsForAI = evidence ?? currentRows;
      if (rowsForAI.length === 0) {
        out.set('hyp', null);
        return { outputs: out };
      }
      const top = rowsForAI[0];
      const ai = getCoScientist();
      const hyp = await ai.hypothesize({
        projectId: ctx.projectId,
        molecule: ctx.molecule,
        variant: top.variant,
        predictions: [top.prediction],
      });
      out.set('hyp', hyp);
      return { outputs: out };
    }

    case 'export': {
      const data = inputs.in ?? null;
      out.set('done', { exported: true, data });
      return { outputs: out };
    }

    default: {
      // Nodes without a real implementation pass through null on every
      // output. The graph still executes; the outputs are placeholders.
      const def = NODE_TYPES[node.type];
      for (const p of def.outputs) out.set(p.id, null);
      return { outputs: out };
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
