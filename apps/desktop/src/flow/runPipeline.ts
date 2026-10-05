import {
  newRunId,
  newVariantId,
  type Molecule,
  type ProjectId,
  type Run,
  type Variant,
} from '@genesis/shared';
import { getStabilityEngine, type StabilityPrediction } from '@genesis/engines';
import { EGFR_VARIANTS, type EGFRVariant } from './flowData';

export interface PipelineRow {
  variant: Variant;
  prediction: StabilityPrediction;
  note: string;
}

export interface PipelineResult {
  run: Run;
  rows: PipelineRow[];
}

function makeVariant(
  src: EGFRVariant,
  molecule: Molecule,
  projectId: ProjectId
): Variant {
  return {
    id: newVariantId(),
    projectId,
    parentMoleculeId: molecule.id,
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
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface RunPipelineOptions {
  projectId: ProjectId;
  molecule: Molecule;
  onProgress?: (done: number, total: number) => void;
  onActiveNode?: (nodeId: string | null) => void;
}

export async function runPipeline(
  options: RunPipelineOptions
): Promise<PipelineResult> {
  const { projectId, molecule, onProgress, onActiveNode } = options;
  const engine = getStabilityEngine();
  const startedAt = new Date().toISOString();

  onActiveNode?.('load');
  await tick();
  onActiveNode?.('variants');
  await tick();

  const total = EGFR_VARIANTS.length;
  const rows: PipelineRow[] = [];

  onActiveNode?.('predict');
  for (let i = 0; i < total; i++) {
    const src = EGFR_VARIANTS[i];
    const variant = makeVariant(src, molecule, projectId);
    const prediction = await engine.predictStability({ molecule, variant });
    rows.push({ variant, prediction, note: src.note });
    onProgress?.(i + 1, total);
  }

  rows.sort((a, b) => a.prediction.deltaDeltaG - b.prediction.deltaDeltaG);

  onActiveNode?.('rank');
  await tick();

  const completedAt = new Date().toISOString();
  const inputHash = await sha256(
    JSON.stringify({ moleculeId: molecule.id, variantCount: total })
  );
  const outputHash = await sha256(
    JSON.stringify(rows.map((r) => [r.variant.hgvs, r.prediction.deltaDeltaG]))
  );

  const run: Run = {
    id: newRunId(),
    projectId,
    mode: 'flow',
    label: 'EGFR stability pipeline',
    tool: 'genesis.pipeline',
    toolVersion: '0.0.1',
    inputs: [{ kind: 'molecule', refId: molecule.id }],
    outputs: rows.map((r) => ({ kind: 'variant', refId: r.variant.id })),
    params: { variantCount: total, engine: engine.name, engineVersion: engine.version },
    status: 'completed',
    createdAt: startedAt,
    startedAt,
    completedAt,
    inputHash,
    outputHash,
  };

  onActiveNode?.(null);
  return { run, rows };
}

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 180));
}
