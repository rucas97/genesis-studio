/**
 * Branded ID types.
 *
 * Plain strings at runtime, distinct at compile time.
 * Prevents passing a MoleculeId where a VariantId is expected.
 */

export type ProjectId = string & { readonly __brand: 'ProjectId' };
export type MoleculeId = string & { readonly __brand: 'MoleculeId' };
export type VariantId = string & { readonly __brand: 'VariantId' };
export type RunId = string & { readonly __brand: 'RunId' };
export type HypothesisId = string & { readonly __brand: 'HypothesisId' };
export type ActionId = string & { readonly __brand: 'ActionId' };
export type EventLogId = string & { readonly __brand: 'EventLogId' };

const uuid = (): string =>
  (globalThis as any).crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const newProjectId = (): ProjectId => `proj_${uuid()}` as ProjectId;
export const newMoleculeId = (): MoleculeId => `mol_${uuid()}` as MoleculeId;
export const newVariantId = (): VariantId => `var_${uuid()}` as VariantId;
export const newRunId = (): RunId => `run_${uuid()}` as RunId;
export const newHypothesisId = (): HypothesisId => `hyp_${uuid()}` as HypothesisId;
export const newActionId = (): ActionId => `act_${uuid()}` as ActionId;
export const newEventLogId = (): EventLogId => `log_${uuid()}` as EventLogId;
