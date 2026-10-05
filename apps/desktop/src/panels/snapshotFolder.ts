import type { Action } from '@genesis/shared';
import type { PlaySnapshot } from './MiniPlayView';

/**
 * Reconstruct a PlaySnapshot by folding through all actions up to and
 * including the given index.
 *
 * This is what makes replay real: the state at any point in the session
 * is derived from the event log, not stored separately.
 */
export function buildSnapshotAtIndex(
  actions: readonly Action[],
  index: number,
  defaultPdbId: string,
  defaultProteinId: string,
): PlaySnapshot {
  let proteinId = defaultProteinId;
  let pdbId = defaultPdbId;
  let pickedResidueNumber: number | null = null;
  let mutatedResidueNumber: number | null = null;
  let mutatedHgvs: string | null = null;
  let ligands: PlaySnapshot['ligands'] = [];

  for (let i = 0; i <= index; i++) {
    const a = actions[i];
    const p = a.payload as Record<string, any>;
    if (a.type === 'play.set_protein') {
      if (p.proteinId) proteinId = p.proteinId;
      if (p.pdbId) pdbId = p.pdbId;
      ligands = [];
      pickedResidueNumber = null;
      mutatedResidueNumber = null;
      mutatedHgvs = null;
    }
    if (a.type === 'play.pick_residue') {
      pickedResidueNumber = p.residueNumber ?? null;
    }
    if (a.type === 'play.mutate') {
      const v = p.variant as { hgvs?: string; position?: number } | undefined;
      if (v) {
        mutatedResidueNumber = v.position ?? null;
        mutatedHgvs = v.hgvs ?? null;
      }
    }
    if (a.type === 'play.add_ligand') {
      ligands = [...ligands, {
        instanceId: p.instanceId,
        ligandId: p.ligandId,
        position: p.position,
      }];
    }
    if (a.type === 'play.move_ligand') {
      ligands = ligands.map((l) =>
        l.instanceId === p.instanceId ? { ...l, position: p.to } : l
      );
    }
    if (a.type === 'play.remove_ligand') {
      ligands = ligands.filter((l) => l.instanceId !== p.instanceId);
    }
  }

  return {
    proteinId,
    pdbId,
    pickedResidueNumber,
    mutatedResidueNumber,
    mutatedHgvs,
    ligands,
  };
}
