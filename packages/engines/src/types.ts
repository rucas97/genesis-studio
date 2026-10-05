import type { Variant, Molecule } from '@genesis/shared';

export interface EngineCapabilities {
  predictsStability: boolean;
  predictsBinding: boolean;
  runsLocally: boolean;
  approximateLatencyMs: number;
  validationScope: string;
}

export interface StabilityPrediction {
  deltaDeltaG: number;
  deltaDeltaGCI: [number, number];
  method: string;
  methodVersion: string;
  notes?: string;
}

export interface EngineContext {
  molecule: Molecule;
  variant: Variant;
}

export interface StabilityEngine {
  readonly name: string;
  readonly version: string;
  capabilities(): EngineCapabilities;
  predictStability(context: EngineContext): Promise<StabilityPrediction>;
}
