import type {
  ProjectId, MoleculeId, VariantId, RunId, HypothesisId, EventLogId
} from './ids';

/**
 * A Project is the top-level container. One project = one research question.
 *
 * Everything else (molecules, variants, runs, hypotheses) belongs to a project.
 * The Project itself is a thin index — it references entities by ID.
 */
export interface Project {
  id: ProjectId;
  name: string;
  description: string;
  owner: string;
  createdAt: string;
  updatedAt: string;

  moleculeIds: MoleculeId[];
  variantIds: VariantId[];
  runIds: RunId[];
  hypothesisIds: HypothesisId[];

  eventLogId: EventLogId;
  schemaVersion: number;
}

export const CURRENT_SCHEMA_VERSION = 1;
