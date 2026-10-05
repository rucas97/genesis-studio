import type { RunId, ProjectId } from './ids';

export type RunMode = 'play' | 'flow' | 'emergence';
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface RunInput {
  kind: 'molecule' | 'variant' | 'file' | 'run' | 'param';
  refId?: string;
  value?: unknown;
}

export interface RunOutput {
  kind: 'molecule' | 'variant' | 'metric' | 'file' | 'hypothesis';
  refId?: string;
  value?: unknown;
}

/**
 * A Run is any execution in any mode: a Play action, a Flow pipeline, or an
 * Emergence simulation. Everything that produces data is a Run.
 *
 * This makes the audit log uniform across modes.
 */
export interface Run {
  id: RunId;
  projectId: ProjectId;
  mode: RunMode;

  label: string;
  tool: string;
  toolVersion: string;

  inputs: RunInput[];
  outputs: RunOutput[];
  params: Record<string, unknown>;

  status: RunStatus;

  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;

  // Hash over inputs + params + tool version. Enables reproducibility.
  inputHash: string;
  outputHash?: string;
}
