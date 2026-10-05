import type {
  Project,
  Molecule,
  Variant,
  Run,
  Hypothesis,
  Action,
} from '../models';

/**
 * The derived state of a project.
 *
 * This is a projection of the EventLog. Play, Flow, and Emergence all read
 * from this. No mode owns state; every mode proposes actions.
 */
export interface ProjectState {
  project: Project;
  molecules: Map<string, Molecule>;
  variants: Map<string, Variant>;
  runs: Map<string, Run>;
  hypotheses: Map<string, Hypothesis>;
  recentActions: Action[];
}

const RECENT_LIMIT = 200;

export function emptyProjectState(project: Project): ProjectState {
  return {
    project,
    molecules: new Map(),
    variants: new Map(),
    runs: new Map(),
    hypotheses: new Map(),
    recentActions: [],
  };
}

/**
 * Apply a single action to the state. This is the reducer.
 *
 * Every mode writes actions; this is where they land. The v1 set covers the
 * demo: Play creates and mutates, Flow runs, AI hypothesizes.
 */
export function applyAction(state: ProjectState, action: Action): ProjectState {
  const recentActions = [...state.recentActions, action].slice(-RECENT_LIMIT);

  switch (action.type) {
    case 'play.create': {
      const molecule = action.payload.molecule as Molecule | undefined;
      if (!molecule) return { ...state, recentActions };
      const molecules = new Map(state.molecules);
      molecules.set(molecule.id, molecule);
      return { ...state, molecules, recentActions };
    }

    case 'play.mutate': {
      const variant = action.payload.variant as Variant | undefined;
      if (!variant) return { ...state, recentActions };
      const variants = new Map(state.variants);
      variants.set(variant.id, variant);
      return { ...state, variants, recentActions };
    }

    case 'play.delete': {
      const moleculeId = action.payload.moleculeId as string | undefined;
      const variantId = action.payload.variantId as string | undefined;
      const molecules = new Map(state.molecules);
      const variants = new Map(state.variants);
      if (moleculeId) molecules.delete(moleculeId);
      if (variantId) variants.delete(variantId);
      return { ...state, molecules, variants, recentActions };
    }

    case 'flow.run.complete': {
      const run = action.payload.run as Run | undefined;
      if (!run) return { ...state, recentActions };
      const runs = new Map(state.runs);
      runs.set(run.id, run);
      return { ...state, runs, recentActions };
    }

    case 'ai.hypothesis.generate': {
      const hypothesis = action.payload.hypothesis as Hypothesis | undefined;
      if (!hypothesis) return { ...state, recentActions };
      const hypotheses = new Map(state.hypotheses);
      hypotheses.set(hypothesis.id, hypothesis);
      return { ...state, hypotheses, recentActions };
    }

    default:
      // Unknown action types are logged but do not change state yet.
      return { ...state, recentActions };
  }
}
