import type { MoleculeId, ProjectId, VariantId } from './ids';

export type MoleculeKind =
  | 'protein'
  | 'dna'
  | 'rna'
  | 'ligand'
  | 'complex'
  | 'ion'
  | 'membrane'
  | 'molecular_machine';

/**
 * How a structure was obtained. This is provenance, not decoration.
 * It determines whether the structure can be trusted for physics.
 */
export type StructureSource =
  | { kind: 'pdb'; pdbId: string }
  | { kind: 'alphafold'; uniprotId: string; modelVersion: string }
  | { kind: 'user_upload'; fileName: string; hash: string }
  | { kind: 'predicted'; method: string; modelVersion: string; inputHash: string };

export interface Molecule {
  id: MoleculeId;
  projectId: ProjectId;
  kind: MoleculeKind;
  name: string;
  description?: string;

  // One-letter code (protein) or nucleotides (DNA/RNA). Empty for ligands.
  sequence: string;

  // Structure source. null if no structure yet.
  structure: StructureSource | null;

  // Parent molecule, if this is a variant, fusion, or complex member.
  parentId?: MoleculeId;

  // Variants applied to this molecule, in order.
  variantIds: VariantId[];

  createdIn: 'play' | 'flow' | 'emergence' | 'import';

  createdAt: string;
  updatedAt: string;
}
