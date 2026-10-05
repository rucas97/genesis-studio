import type { Molecule, Variant, Hypothesis, ProjectId } from '@genesis/shared';
import type { StabilityPrediction } from '@genesis/engines';

export interface CoScientistCapabilities {
  canObserve: boolean;
  canHypothesize: boolean;
  canProposeExperiment: boolean;
  runsLocally: boolean;
  approximateLatencyMs: number;
  validationScope: string;
}

export interface CoScientistInput {
  projectId: ProjectId;
  molecule: Molecule;
  variant: Variant;
  predictions: StabilityPrediction[];
}

export interface Observation {
  summary: string;
  agreement: number;
  confidence: number;
  flags: string[];
  notes?: string;
}

export interface CoScientist {
  readonly name: string;
  readonly version: string;
  capabilities(): CoScientistCapabilities;
  observe(input: CoScientistInput): Promise<Observation>;
  hypothesize(input: CoScientistInput): Promise<Hypothesis>;
}
