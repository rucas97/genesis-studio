import type {
  CoScientist, CoScientistCapabilities, CoScientistInput, Observation,
} from '../types';
import type { Hypothesis } from '@genesis/shared';
import { newHypothesisId } from '@genesis/shared';

const DEFAULT_URL = 'http://127.0.0.1:11434';

export class OllamaCoScientist implements CoScientist {
  readonly name: string;
  readonly version = '1.0.0';
  constructor(private baseUrl: string, private model: string) {
    this.name = `Ollama:${model}`;
  }
  capabilities(): CoScientistCapabilities {
    return {
      canObserve: true, canHypothesize: true, canProposeExperiment: true,
      runsLocally: true, approximateLatencyMs: 4000,
      validationScope: 'Local LLM. Output is not validated against curated data. Treat as assistance, not authority.',
    };
  }

  async observe(input: CoScientistInput): Promise<Observation> {
    const raw = await this.generate(buildObservePrompt(input));
    const parsed = tryParseJSON(raw) as Partial<Observation> | null;
    if (!parsed) return fallbackObservation(input);
    return {
      summary: String(parsed.summary ?? ''),
      agreement: clamp01(Number(parsed.agreement ?? 0)),
      confidence: clamp01(Number(parsed.confidence ?? 0)),
      flags: Array.isArray(parsed.flags) ? parsed.flags.map(String) : [],
      notes: parsed.notes ? String(parsed.notes) : undefined,
    };
  }

  async hypothesize(input: CoScientistInput): Promise<Hypothesis> {
    const raw = await this.generate(buildHypothesizePrompt(input));
    const parsed = tryParseJSON(raw) as any;
    const obs = await this.observe(input);
    if (!parsed) return fallbackHypothesis(input, obs);
    return {
      id: newHypothesisId(),
      projectId: input.projectId,
      source: 'play',
      claim: String(parsed.claim ?? ''),
      mechanism: String(parsed.mechanism ?? ''),
      predictions: Array.isArray(parsed.predictions)
        ? parsed.predictions.map((p: any) => ({
            type: (p.type ?? 'other') as any,
            test: String(p.test ?? ''),
            expected: String(p.expected ?? ''),
          }))
        : [],
      uncertainty: {
        confidence: obs.confidence, methodAgreement: obs.agreement,
        trainingDistribution: 'unknown', physicalPlausibility: 'valid',
        notes: 'LLM-generated. Not calibrated. Verify with a real method.',
      },
      evidence: {
        methodsAgreeing: [], methodsDisagreeing: [],
        literatureStatus: 'not checked', novelty: 'unknown',
      },
      falsification: String(parsed.falsification ?? 'Not specified.'),
      nextExperiment: { description: String(parsed.nextExperiment?.description ?? '') },
      derivedFromRunIds: [],
      createdAt: new Date().toISOString(),
    };
  }

  private async generate(prompt: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt, stream: false, format: 'json', options: { temperature: 0.2, top_p: 0.9 } }),
    });
    if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
    const json = (await res.json()) as { response?: string };
    return json.response ?? '';
  }
}

function buildObservePrompt(input: CoScientistInput): string {
  const { molecule, variant, predictions, binding } = input;
  const pred = predictions[0];
  const lines = [
    'You are a computational biology co-scientist. Be terse. Do not exaggerate.',
    '',
    `Protein: ${molecule.name}`,
    `Variant: ${variant.hgvs}`,
    `Prediction: deltaDeltaG = ${pred?.deltaDeltaG} kcal/mol, method = ${pred?.method}`,
  ];
  if (binding) {
    lines.push('', `Ligand: ${binding.ligandName} (${binding.ligandFormula})`,
      `Distance: ${binding.distanceAngstrom} Angstrom`,
      `Estimated Kd: ${binding.estimatedKdNm} nM (geometric stub, not a real docking score)`);
  }
  lines.push(
    '',
    'Return ONLY valid JSON with this exact shape:',
    '{ "summary": string, "agreement": number, "confidence": number, "flags": string[], "notes": string }'
  );
  return lines.join('\n');
}

function buildHypothesizePrompt(input: CoScientistInput): string {
  const { molecule, variant, predictions, binding } = input;
  const pred = predictions[0];
  const lines = [
    'You are a computational biology co-scientist. Produce a falsifiable',
    'hypothesis. Keep claims specific and testable. Do not invent references.',
    '',
    `Protein: ${molecule.name}`,
    `Variant: ${variant.hgvs}`,
    `Predicted deltaDeltaG: ${pred?.deltaDeltaG} kcal/mol`,
  ];
  if (binding) {
    lines.push('', `Ligand: ${binding.ligandName} (${binding.ligandFormula})`,
      `Distance: ${binding.distanceAngstrom} Angstrom`,
      `Estimated Kd: ${binding.estimatedKdNm} nM (geometric stub)`);
  }
  lines.push(
    '',
    'Return ONLY valid JSON:',
    '{ "claim": string, "mechanism": string, "predictions": [{"type": string, "test": string, "expected": string}], "falsification": string, "nextExperiment": {"description": string} }'
  );
  return lines.join('\n');
}

function tryParseJSON(text: string): unknown | null {
  try { return JSON.parse(text); } catch {
    const s = text.indexOf('{'); const e = text.lastIndexOf('}');
    if (s >= 0 && e > s) { try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; } }
    return null;
  }
}
function clamp01(n: number): number { return !Number.isFinite(n) ? 0 : Math.max(0, Math.min(1, n)); }

function fallbackObservation(input: CoScientistInput): Observation {
  const count = input.predictions.length;
  const ddg = count > 0 ? input.predictions[0].deltaDeltaG : 0;
  return {
    summary: `${input.variant.hgvs} on ${input.molecule.name}: ΔΔG ${ddg.toFixed(2)} kcal/mol.`,
    agreement: count > 0 ? 1 : 0, confidence: 0.5,
    flags: ['llm_parse_failed'], notes: 'Model output unparseable. Stub returned.',
  };
}

function fallbackHypothesis(input: CoScientistInput, obs: Observation): Hypothesis {
  return {
    id: newHypothesisId(), projectId: input.projectId, source: 'play',
    claim: `${input.variant.hgvs} alters stability of ${input.molecule.name}.`,
    mechanism: 'Mechanism not produced (LLM output unparseable).',
    predictions: [],
    uncertainty: { confidence: obs.confidence, methodAgreement: obs.agreement,
      trainingDistribution: 'unknown', physicalPlausibility: 'valid',
      notes: 'Fallback due to LLM parse failure.' },
    evidence: { methodsAgreeing: [], methodsDisagreeing: [],
      literatureStatus: 'not checked', novelty: 'unknown' },
    falsification: 'Not specified (fallback).',
    nextExperiment: { description: 'Not specified (fallback).' },
    derivedFromRunIds: [], createdAt: new Date().toISOString(),
  };
}

export interface OllamaHealth { ok: boolean; baseUrl: string; models: string[]; chosenModel: string; }
const PREFERRED_MODELS = ['llama3.1', 'llama3.2', 'llama3', 'qwen2.5', 'mistral', 'phi3', 'gemma2'];

export async function probeOllama(
  baseUrl: string = DEFAULT_URL, timeoutMs = 1000
): Promise<OllamaHealth | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const json = (await res.json()) as { models?: Array<{ name: string }> };
    const models = (json.models ?? []).map((m) => m.name);
    if (models.length === 0) return null;
    const chosen = PREFERRED_MODELS.find((p) => models.some((m) => m.startsWith(p))) ?? models[0];
    return { ok: true, baseUrl, models, chosenModel: chosen };
  } catch { return null; }
}
