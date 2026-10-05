import type { HypothesisId, ProjectId } from './ids';

export type HypothesisSource = 'play' | 'flow' | 'emergence';

export interface Prediction {
  type: 'biophysical' | 'functional' | 'cellular' | 'organismal' | 'other';
  test: string;
  expected: string;
}

export interface MethodAgreement {
  method: string;
  methodVersion: string;
  value: number | string;
  weight: number;
}

export interface Uncertainty {
  confidence: number;
  methodAgreement: number;
  trainingDistribution: 'in_distribution' | 'out_of_distribution' | 'unknown';
  physicalPlausibility: 'valid' | 'questionable' | 'invalid';
  notes?: string;
}

export interface Evidence {
  methodsAgreeing: MethodAgreement[];
  methodsDisagreeing: MethodAgreement[];
  literatureStatus: string;
  literatureRefs?: string[];
  novelty: 'known' | 'partially_known' | 'novel';
}

export interface EmergenceContext {
  timescale: string;
  scales: string[];
  causalChain: string[];
  criticalTransition?: string;
  interventionPoints?: string[];
}

export interface NextExperiment {
  description: string;
  protocol?: string;
  primers?: string[];
  reagents?: string[];
}

/**
 * A Hypothesis is the output of the AI co-scientist.
 *
 * Rules:
 *   - Every hypothesis is falsifiable. No exceptions.
 *   - Every hypothesis carries calibrated uncertainty.
 *   - Every hypothesis proposes the experiment that would test it.
 */
export interface Hypothesis {
  id: HypothesisId;
  projectId: ProjectId;
  source: HypothesisSource;

  claim: string;
  mechanism: string;

  predictions: Prediction[];
  uncertainty: Uncertainty;
  evidence: Evidence;

  emergenceContext?: EmergenceContext;

  falsification: string;
  nextExperiment: NextExperiment;

  derivedFromRunIds: string[];

  // 0-1. Higher = more likely to be a breakthrough.
  breakthroughScore?: number;

  createdAt: string;
}
