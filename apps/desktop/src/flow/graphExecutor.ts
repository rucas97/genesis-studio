import type { Molecule, ProjectId, Variant } from '@genesis/shared';
import { newVariantId } from '@genesis/shared';
import {
  getStabilityEngine,
  type StabilityPrediction,
  fetchUniProtSequence,
  type UniProtSequence,
} from '@genesis/engines';
import { getCoScientist } from '@genesis/ai';
import { NODE_TYPES } from './nodeTypes';
import type { NodeInstance, EdgeInstance } from './NodeEditor';
import { EGFR_VARIANTS } from './flowData';
import { parseVCF, type ParsedVariant } from './vcfParser';
import { parseBatchVariants } from './batchVariants';

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
  onExport?: (filename: string, content: string, mime: string) => void;
}

export interface ExecutionResult {
  rows: PipelineRow[];
  engineName: string;
  engineVersion: string;
  totalMs: number;
}

export function topoSort(nodes: NodeInstance[], edges: EdgeInstance[]): NodeInstance[] {
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
    await sleep(100);

    const def = NODE_TYPES[node.type];
    if (!def) continue;

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

    case 'fetch_sequence': {
      const uniprotId = String(node.params.uniprotId ?? '').trim();
      if (!uniprotId) { out.set('seq', null); return { outputs: out }; }
      const seq: UniProtSequence | null = await fetchUniProtSequence(uniprotId);
      out.set('seq', seq);
      return { outputs: out };
    }

    case 'batch_variants': {
      const text = String(node.params.text ?? '');
      const parsed = parseBatchVariants(text);
      out.set('vars', parsed);
      return { outputs: out };
    }

    case 'vcf_import': {
      const content = String(node.params.content ?? '');
      if (!content) { out.set('vars', []); return { outputs: out }; }
      out.set('vars', parseVCF(content));
      return { outputs: out };
    }

    case 'predict_stability': {
      const incoming = inputs.vars as ParsedVariant[] | undefined;
      const list: ParsedVariant[] = incoming && incoming.length > 0
        ? incoming
        : EGFR_VARIANTS.map((v) => ({
            hgvs: v.hgvs, position: v.position, ref: v.ref, alt: v.alt,
            kind: v.kind === 'substitution' ? 'substitution' as const
              : v.kind === 'deletion' ? 'deletion' as const : 'insertion' as const,
            note: v.note,
          }));

      const total = list.length;
      const scored: PipelineRow[] = [];
      for (let i = 0; i < total; i++) {
        const src = list[i];
        const variant: Variant = {
          id: newVariantId(), projectId: ctx.projectId,
          parentMoleculeId: ctx.molecule.id,
          kind: src.kind === 'substitution' ? 'substitution'
            : src.kind === 'deletion' ? 'deletion' : 'insertion',
          origin: 'somatic',
          hgvs: src.hgvs, position: src.position, ref: src.ref, alt: src.alt,
          predictions: [], createdIn: 'flow',
          createdAt: new Date().toISOString(),
        };
        const prediction = await engine.predictStability({ molecule: ctx.molecule, variant });
        scored.push({ variant, prediction, note: src.note });
        ctx.onProgress(i + 1, total);
      }
      scored.sort((a, b) => a.prediction.deltaDeltaG - b.prediction.deltaDeltaG);
      out.set('results', scored);
      return { outputs: out, rows: scored };
    }

    case 'filter': {
      const incoming = (inputs.rows as PipelineRow[] | undefined) ?? currentRows;
      const threshold = Number(node.params.threshold ?? -1);
      const kept = incoming.filter((r) => r.prediction.deltaDeltaG <= threshold);
      out.set('kept', kept);
      return { outputs: out, rows: kept };
    }

    case 'sort': {
      const incoming = (inputs.rows as PipelineRow[] | undefined) ?? currentRows;
      const dir = String(node.params.direction ?? 'ascending');
      const sorted = [...incoming].sort((a, b) =>
        dir === 'ascending'
          ? a.prediction.deltaDeltaG - b.prediction.deltaDeltaG
          : b.prediction.deltaDeltaG - a.prediction.deltaDeltaG
      );
      out.set('sorted', sorted);
      return { outputs: out, rows: sorted };
    }

    case 'ai_hypothesis': {
      const evidence = inputs.evidence as PipelineRow[] | undefined;
      const rowsForAI = evidence ?? currentRows;
      if (rowsForAI.length === 0) { out.set('hyp', null); return { outputs: out }; }
      const top = rowsForAI[0];
      const hyp = await getCoScientist().hypothesize({
        projectId: ctx.projectId,
        molecule: ctx.molecule,
        variant: top.variant,
        predictions: [top.prediction],
      });
      out.set('hyp', hyp);
      return { outputs: out };
    }

    case 'export_csv': {
      const data = (inputs.rows as PipelineRow[] | undefined) ?? currentRows;
      const filename = String(node.params.filename ?? 'results.csv');
      const lines = ['rank,hgvs,ddg_lo,ddg,ddg_hi,note'];
      data.forEach((r, i) => {
        const [lo, hi] = r.prediction.deltaDeltaGCI;
        lines.push([i + 1, r.variant.hgvs,
          lo.toFixed(2), r.prediction.deltaDeltaG.toFixed(2), hi.toFixed(2),
          csvEscape(r.note)].join(','));
      });
      if (ctx.onExport) ctx.onExport(filename, lines.join('\n') + '\n', 'text/csv');
      out.set('done', { filename, rows: data.length });
      return { outputs: out };
    }

    case 'export_json': {
      const data = (inputs.rows as PipelineRow[] | undefined) ?? currentRows;
      const filename = String(node.params.filename ?? 'results.json');
      const content = JSON.stringify(
        data.map((r, i) => ({
          rank: i + 1, hgvs: r.variant.hgvs,
          deltaDeltaG: r.prediction.deltaDeltaG,
          deltaDeltaGCI: r.prediction.deltaDeltaGCI,
          method: r.prediction.method,
          methodVersion: r.prediction.methodVersion,
          note: r.note,
        })), null, 2);
      if (ctx.onExport) ctx.onExport(filename, content, 'application/json');
      out.set('done', { filename, rows: data.length });
      return { outputs: out };
    }

    default: {
      const def = NODE_TYPES[node.type];
      for (const p of def.outputs) out.set(p.id, null);
      return { outputs: out };
    }
  }
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
