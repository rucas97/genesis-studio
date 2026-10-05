export type PortKind =
  | 'sequence' | 'structure' | 'variant' | 'alignment'
  | 'tree' | 'data' | 'any';

export type NodeCategory =
  | 'input' | 'sequence' | 'structure' | 'genomics' | 'utility' | 'ai';

export interface PortDef {
  id: string;
  label: string;
  kind: PortKind;
}

export interface ParamDef {
  key: string;
  label: string;
  type: 'number' | 'text' | 'textarea' | 'select' | 'file';
  options?: string[];
  default: unknown;
  help?: string;
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
  // -------------------- input --------------------
  fetch_pdb: {
    key: 'fetch_pdb',
    label: 'Fetch PDB',
    category: 'input',
    description: 'Download a structure from RCSB',
    inputs: [],
    outputs: [{ id: 'struct', label: 'structure', kind: 'structure' }],
    params: [{ key: 'pdbId', label: 'PDB ID', type: 'text', default: '4HJO' }],
  },
  fetch_sequence: {
    key: 'fetch_sequence',
    label: 'Fetch sequence',
    category: 'input',
    description: 'Fetch a sequence from UniProt (requires network)',
    inputs: [],
    outputs: [{ id: 'seq', label: 'sequence', kind: 'sequence' }],
    params: [
      { key: 'uniprotId', label: 'UniProt ID', type: 'text', default: 'P00533', help: 'P00533 is EGFR' },
    ],
  },
  batch_variants: {
    key: 'batch_variants',
    label: 'Batch variants',
    category: 'input',
    description: 'Paste HGVS variants, one per line',
    inputs: [],
    outputs: [{ id: 'vars', label: 'variants', kind: 'variant' }],
    params: [
      {
        key: 'text',
        label: 'Variants',
        type: 'textarea',
        default: 'p.L858R # activating\np.T790M # gatekeeper\np.C797S # covalent resistance\np.G719S # exon 18',
        help: 'One HGVS per line. Optional # comment.',
      },
    ],
  },
  vcf_import: {
    key: 'vcf_import',
    label: 'VCF import',
    category: 'input',
    description: 'Load variants from a VCF file',
    inputs: [],
    outputs: [{ id: 'vars', label: 'variants', kind: 'variant' }],
    params: [
      {
        key: 'content',
        label: 'VCF',
        type: 'file',
        default: '',
        help: 'Choose a .vcf file. Content is embedded in the graph.',
      },
    ],
  },

  // -------------------- sequence --------------------
  blast: {
    key: 'blast',
    label: 'BLAST',
    category: 'sequence',
    description: 'Find homologous sequences (stub)',
    inputs: [{ id: 'query', label: 'query', kind: 'sequence' }],
    outputs: [{ id: 'hits', label: 'hits', kind: 'alignment' }],
  },
  msa: {
    key: 'msa',
    label: 'Multiple alignment',
    category: 'sequence',
    description: 'Align sequences (stub)',
    inputs: [{ id: 'seqs', label: 'sequences', kind: 'alignment' }],
    outputs: [{ id: 'aln', label: 'alignment', kind: 'alignment' }],
  },
  tree: {
    key: 'tree',
    label: 'Phylogenetic tree',
    category: 'sequence',
    description: 'Build a tree (stub)',
    inputs: [{ id: 'aln', label: 'alignment', kind: 'alignment' }],
    outputs: [{ id: 'tree', label: 'tree', kind: 'tree' }],
  },

  // -------------------- structure --------------------
  mutate: {
    key: 'mutate',
    label: 'Apply variant',
    category: 'structure',
    description: 'Apply a mutation to a structure',
    inputs: [
      { id: 'struct', label: 'structure', kind: 'structure' },
      { id: 'vars', label: 'variants', kind: 'variant' },
    ],
    outputs: [{ id: 'struct', label: 'structure', kind: 'structure' }],
  },
  predict_stability: {
    key: 'predict_stability',
    label: 'Predict stability',
    category: 'structure',
    description: 'ΔΔG prediction. Uses the active engine (stub or sidecar).',
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
    description: 'Dock a ligand (stub)',
    inputs: [
      { id: 'struct', label: 'structure', kind: 'structure' },
      { id: 'ligand', label: 'ligand', kind: 'data' },
    ],
    outputs: [{ id: 'poses', label: 'poses', kind: 'data' }],
  },

  // -------------------- genomics --------------------
  annotate: {
    key: 'annotate',
    label: 'Annotate',
    category: 'genomics',
    description: 'Annotate variants (stub)',
    inputs: [{ id: 'vcf', label: 'variants', kind: 'variant' }],
    outputs: [{ id: 'ann', label: 'annotated', kind: 'variant' }],
  },
  filter: {
    key: 'filter',
    label: 'Filter by ΔΔG',
    category: 'genomics',
    description: 'Keep only variants with ΔΔG below a threshold',
    inputs: [{ id: 'rows', label: 'results', kind: 'data' }],
    outputs: [{ id: 'kept', label: 'results', kind: 'data' }],
    params: [
      { key: 'threshold', label: 'Max ΔΔG (kcal/mol)', type: 'number', default: -1.0 },
    ],
  },
  sort: {
    key: 'sort',
    label: 'Sort',
    category: 'genomics',
    description: 'Sort results by ΔΔG',
    inputs: [{ id: 'rows', label: 'results', kind: 'data' }],
    outputs: [{ id: 'sorted', label: 'results', kind: 'data' }],
    params: [
      {
        key: 'direction',
        label: 'Direction',
        type: 'select',
        options: ['ascending', 'descending'],
        default: 'ascending',
      },
    ],
  },

  // -------------------- utility --------------------
  script: {
    key: 'script',
    label: 'Python script',
    category: 'utility',
    description: 'Run a user script (stub)',
    inputs: [{ id: 'in', label: 'input', kind: 'data' }],
    outputs: [{ id: 'out', label: 'output', kind: 'data' }],
    params: [{ key: 'code', label: 'Code', type: 'textarea', default: '# your code here' }],
  },
  export_csv: {
    key: 'export_csv',
    label: 'Export CSV',
    category: 'utility',
    description: 'Write results to a CSV file',
    inputs: [{ id: 'rows', label: 'results', kind: 'data' }],
    outputs: [],
    params: [
      { key: 'filename', label: 'Filename', type: 'text', default: 'results.csv' },
    ],
  },
  export_json: {
    key: 'export_json',
    label: 'Export JSON',
    category: 'utility',
    description: 'Write results to a JSON file',
    inputs: [{ id: 'rows', label: 'results', kind: 'data' }],
    outputs: [],
    params: [
      { key: 'filename', label: 'Filename', type: 'text', default: 'results.json' },
    ],
  },

  // -------------------- ai --------------------
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
  input: '#66ccff',
  sequence: '#88ddff',
  structure: '#88ff88',
  genomics: '#ffcc66',
  utility: '#8899aa',
  ai: '#cc88ff',
};

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  input: 'Input',
  sequence: 'Sequence',
  structure: 'Structure',
  genomics: 'Genomics',
  utility: 'Utility',
  ai: 'AI',
};
