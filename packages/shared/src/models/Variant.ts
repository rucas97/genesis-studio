import type { VariantId, ProjectId, MoleculeId } from './ids';

export type VariantKind =
  | 'substitution'
  | 'deletion'
  | 'insertion'
  | 'duplication'
  | 'inversion'
  | 'translocation'
  | 'frameshift'
  | 'fusion';

export type VariantOrigin = 'germline' | 'somatic' | 'synthetic' | 'unknown';

export type VariantClassification =
  | 'benign'
  | 'likely_benign'
  | 'vus'
  | 'likely_pathogenic'
  | 'pathogenic';

/**
 * A prediction from one method. Multiple predictions accumulate over time.
 * The consensus is computed by the AI ensemble, not stored here.
 */
export interface PredictedEffect {
  method: string;
  methodVersion: string;
  deltaDeltaG?: number;
  deltaDeltaGCI?: [number, number];
  classification?: VariantClassification;
  notes?: string;
  createdAt: string;
}

export interface Variant {
  id: VariantId;
  projectId: ProjectId;
  parentMoleculeId: MoleculeId;
  kind: VariantKind;
  origin: VariantOrigin;

  // HGVS notation, protein ("p.R175H") or nucleotide ("c.524G>A").
  hgvs: string;
  position?: number;
  ref?: string;
  alt?: string;

  predictions: PredictedEffect[];

  createdIn: 'play' | 'flow' | 'emergence';

  createdAt: string;
}
