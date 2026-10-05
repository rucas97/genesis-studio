import type {
  CoScientist,
  CoScientistCapabilities,
  CoScientistInput,
  Observation,
} from '../types';
import type { Hypothesis } from '@genesis/shared';
import { newHypothesisId } from '@genesis/shared';

const DEFAULT_URL = 'http://127.0.0.1:11434';

/**
 * Local LLM co-scientist backed by Ollama.
 *
 * Ollama is a simple local model server. If it is running, this class
 * turns the stub co-scientist into a real one that reasons about the
 * variant and prediction.
 *
 * The model is prompted for strict JSON. If parsing fails, the class
 * falls back to a stub-shaped response so the app never breaks.
 *
 * No API key. No cloud. The model runs on the local machine.
 */
export class OllamaCoScientist implements CoScientist {
  readonly name: string;
  readonly version = '1.0.0';

  constructor(
    private baseUrl: string,
    private model: string
  ) {
    this.name = `Ollama:${model}`;
  }

  capabilities(): CoScientistCapabilities {
    return {
      canObserve: true,
      canHypothesize: true,
      canProposeExperiment: true,
      runsLocally: true,
      approximateLatencyMs: 4000,
      validationScope:
        'Local LLM. Output is not validated against curated data. Treat as assistance, not authority.',
    };
  }

  async observe(input: CoScientistInput): Promise<Observation> {
    const prompt = buildObservePrompt(input);
    const raw = await this.generate(prompt);
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
    const prompt = buildHypothesizePrompt(input);
    const raw = await this.generate(prompt);
    const parsed = tryParseJSON(raw) as any;

    const obs = await this.observe(input);

    if (!parsed) {
      return fallbackHypothesis(input, obs);
    }

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
        confidence: obs.confidence,
        methodAgreement: obs.agreement,
        trainingDistribution: 'unknown',
        physicalPlausibility: 'valid',
        notes: 'LLM-generated. Not calibrated. Verify with a real method.',
      },
      evidence: {
        methodsAgreeing: [],
        methodsDisagreeing: [],
        literatureStatus: 'not checked',
        novelty: 'unknown',
      },
      falsification: String(parsed.falsification ?? 'Not specified.'),
      nextExperiment: {
        description: String(parsed.nextExperiment?.description ?? ''),
        protocol: parsed.nextExperiment?.protocol,
        primers: parsed.nextExperiment?.primers,
        reagents: parsed.nextExperiment?.reagents,
      },
      derivedFromRunIds: [],
      createdAt: new Date().toISOString(),
    };
  }

  private async generate(prompt: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        format: 'json',
        options: { temperature: 0.2, top_p: 0.9 },
      }),
    });
    if (!res.ok) {
      throw new Error(`Ollama returned ${res.status}`);
    }
    const json = (await res.json()) as { response?: string };
    return json.response ?? '';
  }
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function buildObservePrompt(input: CoScientistInput): string {
  const { molecule, variant, predictions } = input;
  const pred = predictions[0];
  return [
    'You are a computational biology co-scientist. Be terse. Do not exaggerate.',
    '',
    `Protein: ${molecule.name} (PDB ${molecule.structure?.kind === 'pdb' ? molecule.structure.pdbId : 'n/a'})`,
    `Variant: ${variant.hgvs}`,
    `Prediction: deltaDeltaG = ${pred?.deltaDeltaG} kcal/mol ` +
      `(95% CI ${pred?.deltaDeltaGCI?.[0]} to ${pred?.deltaDeltaGCI?.[1]}), ` +
      `method = ${pred?.method}`,
    '',
    'Return ONLY valid JSON with this exact shape:',
    '{',
    '  "summary": string,   // one sentence, no hype',
    '  "agreement": number, // 0..1',
    '  "confidence": number,// 0..1',
    '  "flags": string[],   // short snake_case tags',
    '  "notes": string      // optional caveats',
    '}',
  ].join('\n');
}

function buildHypothesizePrompt(input: CoScientistInput): string {
  const { molecule, variant, predictions } = input;
  const pred = predictions[0];
  return [
    'You are a computational biology co-scientist. Produce a falsifiable',
    'hypothesis about the effect of a variant. Keep claims specific and',
    'testable. Do not invent literature references.',
    '',
    `Protein: ${molecule.name} (PDB ${molecule.structure?.kind === 'pdb' ? molecule.structure.pdbId : 'n/a'})`,
    `Variant: ${variant.hgvs}`,
    `Predicted deltaDeltaG: ${pred?.deltaDeltaG} kcal/mol (${pred?.method})`,
    '',
    'Return ONLY valid JSON with this exact shape:',
    '{',
    '  "claim": string,        // one sentence, falsifiable',
    '  "mechanism": string,    // 2-3 sentences',
    '  "predictions": [        // 1-3 items',
    '    { "type": "biophysical"|"functional"|"cellular", "test": string, "expected": string }',
    '  ],',
    '  "falsification": string,',
    '  "nextExperiment": { "description": string }',
    '}',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryParseJSON(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function fallbackObservation(input: CoScientistInput): Observation {
  const count = input.predictions.length;
  const ddg = count > 0 ? input.predictions[0].deltaDeltaG : 0;
  return {
    summary: `${input.variant.hgvs} on ${input.molecule.name}: ΔΔG ${ddg.toFixed(2)} kcal/mol.`,
    agreement: count > 0 ? 1 : 0,
    confidence: 0.5,
    flags: ['llm_parse_failed'],
    notes: 'Model output could not be parsed as JSON. Raw stub observation returned.',
  };
}

function fallbackHypothesis(
  input: CoScientistInput,
  obs: Observation
): Hypothesis {
  return {
    id: newHypothesisId(),
    projectId: input.projectId,
    source: 'play',
    claim: `${input.variant.hgvs} alters stability of ${input.molecule.name}.`,
    mechanism: 'Mechanism not produced (LLM output unparseable).',
    predictions: [],
    uncertainty: {
      confidence: obs.confidence,
      methodAgreement: obs.agreement,
      trainingDistribution: 'unknown',
      physicalPlausibility: 'valid',
      notes: 'Fallback due to LLM parse failure.',
    },
    evidence: {
      methodsAgreeing: [],
      methodsDisagreeing: [],
      literatureStatus: 'not checked',
      novelty: 'unknown',
    },
    falsification: 'Not specified (fallback).',
    nextExperiment: { description: 'Not specified (fallback).' },
    derivedFromRunIds: [],
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Probing
// ---------------------------------------------------------------------------

export interface OllamaHealth {
  ok: boolean;
  baseUrl: string;
  models: string[];
  chosenModel: string;
}

const PREFERRED_MODELS = [
  'llama3.1',
  'llama3.2',
  'llama3',
  'qwen2.5',
  'qwen2.5-coder',
  'mistral',
  'phi3',
  'gemma2',
];

export async function probeOllama(
  baseUrl: string = DEFAULT_URL,
  timeoutMs = 1000
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
    const chosen =
      PREFERRED_MODELS.find((p) => models.some((m) => m.startsWith(p))) ??
      models[0];
    return { ok: true, baseUrl, models, chosenModel: chosen };
  } catch {
    return null;
  }
}
