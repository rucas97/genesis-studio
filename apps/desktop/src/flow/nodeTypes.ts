export type PortKind =
  | 'sequence'
  | 'structure'
  | 'variant'
  | 'alignment'
  | 'tree'
  | 'data'
  | 'any';

export type NodeCategory =
  | 'sequence'
  | 'structure'
  | 'genomics'
  | 'utility'
  | 'ai';

export interface PortDef {
  id: string;
  label: string;
  kind: PortKind;
}

export interface ParamDef {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select';
  options?: string[];
  default: unknown;
}

export interface NodeTypeDef {
  key: string;
  label: string;
  category: NodeCategory;
  description: string;
  inputs: PortDef[];
  outputs: PortDef[];
  params?: ParamDef[];
}

export const NODE_TYPES: Record<string, NodeTypeDef> = {
  fetch_sequence: {
    key: 'fetch_sequence',
    label: 'Fetch sequence',
    category: 'sequence',
    description: 'Retrieve a sequence from NCBI or UniProt',
    inputs: [],
    outputs: [{ id: 'seq', label: 'sequence', kind: 'sequence' }],
  },
  blast: {
    key: 'blast',
    label: 'BLAST',
    category: 'sequence',
    description: 'Find homologous sequences',
    inputs: [{ id: 'query', label: 'query', kind: 'sequence' }],
    outputs: [{ id: 'hits', label: 'hits', kind: 'alignment' }],
  },
  msa: {
    key: 'msa',
    label: 'Multiple alignment',
    category: 'sequence',
    description: 'Align sequences (MAFFT / Clustal)',
    inputs: [{ id: 'seqs', label: 'sequences', kind: 'alignment' }],
    outputs: [{ id: 'aln', label: 'alignment', kind: 'alignment' }],
  },
  tree: {
    key: 'tree',
    label: 'Phylogenetic tree',
    category: 'sequence',
    description: 'Build a tree from an alignment',
    inputs: [{ id: 'aln', label: 'alignment', kind: 'alignment' }],
    outputs: [{ id: 'tree', label: 'tree', kind: 'tree' }],
  },
  fetch_pdb: {
    key: 'fetch_pdb',
    label: 'Fetch PDB',
    category: 'structure',
    description: 'Download a structure from RCSB',
    inputs: [],
    outputs: [{ id: 'struct', label: 'structure', kind: 'structure' }],
    params: [{ key: 'pdbId', label: 'PDB ID', type: 'text', default: '4HJO' }],
  },
  fold: {
    key: 'fold',
    label: 'Fold',
    category: 'structure',
    description: 'Predict a structure (AlphaFold / ESMFold)',
    inputs: [{ id: 'seq', label: 'sequence', kind: 'sequence' }],
    outputs: [{ id: 'struct', label: 'structure', kind: 'structure' }],
  },
  mutate: {
    key: 'mutate',
    label: 'Apply variant',
    category: 'structure',
    description: 'Apply a mutation to a structure',
    inputs: [
      { id: 'struct', label: 'structure', kind: 'structure' },
      { id: 'var', label: 'variant', kind: 'variant' },
    ],
    outputs: [{ id: 'struct', label: 'structure', kind: 'structure' }],
  },
  predict_stability: {
    key: 'predict_stability',
    label: 'Predict stability',
    category: 'structure',
    description: 'ΔΔG prediction (stub engine v0.0.1)',
    inputs: [
      { id: 'struct', label: 'structure', kind: 'structure' },
      { id: 'vars', label: 'variants', kind: 'variant' },
    ],
    outputs: [{ id: 'results', label: 'results', kind: 'data' }],
  },
  docking: {
    key: 'docking',
    label: 'Docking',
    category: 'structure',
    description: 'Dock a ligand into a structure',
    inputs: [
      { id: 'struct', label: 'structure', kind: 'structure' },
      { id: 'ligand', label: 'ligand', kind: 'data' },
    ],
    outputs: [{ id: 'poses', label: 'poses', kind: 'data' }],
  },
  variant_call: {
    key: 'variant_call',
    label: 'Variant call',
    category: 'genomics',
    description: 'Call variants from reads (GATK / DeepVariant)',
    inputs: [{ id: 'reads', label: 'reads', kind: 'data' }],
    outputs: [{ id: 'vcf', label: 'variants', kind: 'variant' }],
  },
  annotate: {
    key: 'annotate',
    label: 'Annotate',
    category: 'genomics',
    description: 'Annotate variants (VEP / SnpEff)',
    inputs: [{ id: 'vcf', label: 'variants', kind: 'variant' }],
    outputs: [{ id: 'ann', label: 'annotated', kind: 'variant' }],
  },
  filter: {
    key: 'filter',
    label: 'Filter',
    category: 'genomics',
    description: 'Filter variants by criteria',
    inputs: [{ id: 'in', label: 'variants', kind: 'variant' }],
    outputs: [{ id: 'out', label: 'variants', kind: 'variant' }],
  },
  script: {
    key: 'script',
    label: 'Python script',
    category: 'utility',
    description: 'Run a user script',
    inputs: [{ id: 'in', label: 'input', kind: 'data' }],
    outputs: [{ id: 'out', label: 'output', kind: 'data' }],
  },
  export: {
    key: 'export',
    label: 'Export',
    category: 'utility',
    description: 'Write results to a file',
    inputs: [{ id: 'in', label: 'data', kind: 'data' }],
    outputs: [],
  },
  ai_hypothesis: {
    key: 'ai_hypothesis',
    label: 'AI hypothesis',
    category: 'ai',
    description: 'Generate a hypothesis from evidence',
    inputs: [{ id: 'evidence', label: 'evidence', kind: 'data' }],
    outputs: [{ id: 'hyp', label: 'hypothesis', kind: 'data' }],
  },
};

export const CATEGORY_COLORS: Record<NodeCategory, string> = {
  sequence: '#66ccff',
  structure: '#88ff88',
  genomics: '#ffcc66',
  utility: '#8899aa',
  ai: '#cc88ff',
};
