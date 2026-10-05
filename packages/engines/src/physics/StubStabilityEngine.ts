import type {
  StabilityEngine,
  StabilityPrediction,
  EngineContext,
  EngineCapabilities,
} from '../types';

const CAPABILITIES: EngineCapabilities = {
  predictsStability: true,
  predictsBinding: false,
  runsLocally: true,
  approximateLatencyMs: 5,
  validationScope:
    'STUB — not validated on any data. Demo-only. Not for scientific use.',
};

function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function range(hash: number, lo: number, hi: number): number {
  const t = (hash % 10000) / 10000;
  return lo + t * (hi - lo);
}

export class StubStabilityEngine implements StabilityEngine {
  readonly name = 'Stub';
  readonly version = '0.0.1';

  capabilities(): EngineCapabilities {
    return CAPABILITIES;
  }

  async predictStability(context: EngineContext): Promise<StabilityPrediction> {
    const { variant } = context;
    const h = hash32(variant.hgvs);
    const deltaDeltaG = range(h, -4.0, 0.5);
    const band = range(h >> 8, 0.2, 0.8);

    return {
      deltaDeltaG: Number(deltaDeltaG.toFixed(2)),
      deltaDeltaGCI: [
        Number((deltaDeltaG - band).toFixed(2)),
        Number((deltaDeltaG + band).toFixed(2)),
      ],
      method: this.name,
      methodVersion: this.version,
      notes: 'Stub output. Not for scientific use.',
    };
  }
}
