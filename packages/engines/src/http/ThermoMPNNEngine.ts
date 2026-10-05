import type {
  StabilityEngine,
  StabilityPrediction,
  EngineContext,
  EngineCapabilities,
} from '../types';

const DEFAULT_URL = 'http://127.0.0.1:8765';

/**
 * Client for the Python engine sidecar.
 *
 * The sidecar may run different runners behind the same HTTP API:
 *   - StubRunner (deterministic placeholder, no ThermoMPNN installed)
 *   - ThermoMPNNRunner (real predictions)
 *
 * The engine name is taken from /health at registration time so the UI
 * tells the truth about what is actually running.
 */
export class SidecarStabilityEngine implements StabilityEngine {
  readonly name: string;
  readonly version: string;

  constructor(
    private baseUrl: string,
    runnerName: string,
    runnerVersion: string,
    private isReal: boolean
  ) {
    this.name = runnerName;
    this.version = runnerVersion;
  }

  get usingRealPredictions(): boolean {
    return this.isReal;
  }

  capabilities(): EngineCapabilities {
    return {
      predictsStability: true,
      predictsBinding: false,
      runsLocally: true,
      approximateLatencyMs: this.isReal ? 300 : 15,
      validationScope: this.isReal
        ? 'ThermoMPNN sidecar. Real ΔΔG predictions.'
        : 'StubRunner sidecar. Deterministic placeholder. Not for scientific use.',
    };
  }

  async predictStability(context: EngineContext): Promise<StabilityPrediction> {
    const { molecule, variant } = context;
    const pdbId =
      molecule.structure && molecule.structure.kind === 'pdb'
        ? molecule.structure.pdbId
        : null;
    if (!pdbId) {
      throw new Error('Sidecar engine requires a PDB structure on the molecule');
    }

    const res = await fetch(`${this.baseUrl}/predict_stability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdbId,
        variant: {
          hgvs: variant.hgvs,
          position: variant.position ?? null,
          ref: variant.ref ?? null,
          alt: variant.alt ?? null,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Sidecar returned ${res.status}: ${text}`);
    }

    const json = (await res.json()) as {
      deltaDeltaG: number;
      deltaDeltaGCI: [number, number];
      method: string;
      methodVersion: string;
      notes?: string;
    };

    return {
      deltaDeltaG: json.deltaDeltaG,
      deltaDeltaGCI: json.deltaDeltaGCI,
      method: json.method,
      methodVersion: json.methodVersion,
      notes: json.notes,
    };
  }
}

export interface SidecarHealth {
  ok: boolean;
  runner: string;
  version: string;
  baseUrl: string;
  isRealPredictor: boolean;
}

const REAL_RUNNER_PATTERN = /thermo|esm|foldx|rosetta|ddg/i;

export async function probeSidecar(
  baseUrl: string = DEFAULT_URL,
  timeoutMs = 800
): Promise<SidecarHealth | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      runner?: string;
      version?: string;
      status?: string;
    };
    const runner = json.runner ?? 'UnknownRunner';
    const version = json.version ?? 'unknown';
    return {
      ok: true,
      runner,
      version,
      baseUrl,
      isRealPredictor: REAL_RUNNER_PATTERN.test(runner),
    };
  } catch {
    return null;
  }
}

// Keep the old name exported for anyone importing it directly.
export { probeSidecar as probeThermoMPNN };
export type ThermoMPNNHealth = SidecarHealth;
