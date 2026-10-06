export interface ProteinEntry {
  id: string;
  pdbId: string;
  gene: string;
  name: string;
  category: 'kinase' | 'tumor-suppressor' | 'oncogene' | 'enzyme' | 'receptor';
  disease: string;
  why: string;
}

/**
 * A small curated library of well-known, well-structured proteins.
 *
 * Every entry has a PDB ID that will actually load, a clinical context,
 * and a reason to study it. This is not exhaustive — it is a starting
 * set that gets a researcher to a real structure in one click.
 */
export const PROTEIN_LIBRARY: ProteinEntry[] = [
  {
    id: 'egfr',
    pdbId: '2ITN',
    gene: 'EGFR',
    name: 'Epidermal growth factor receptor',
    category: 'kinase',
    disease: 'Non-small cell lung cancer',
    why: 'Canonical kinase target. L858R, T790M, C797S drive resistance. 2ITN has wildtype L858.',
  },
  {
    id: 'kras',
    pdbId: '4OBE',
    gene: 'KRAS',
    name: 'KRAS GTPase',
    category: 'oncogene',
    disease: 'Pancreatic, lung, colorectal cancer',
    why: 'The most commonly mutated oncogene. G12C, G12D, G12V.',
  },
  {
    id: 'braf',
    pdbId: '4MNE',
    gene: 'BRAF',
    name: 'B-Raf kinase',
    category: 'kinase',
    disease: 'Melanoma, thyroid, colorectal cancer',
    why: 'V600E is the target of vemurafenib. Resistance through splicing.',
  },
  {
    id: 'tp53',
    pdbId: '4HJE',
    gene: 'TP53',
    name: 'p53 DNA-binding domain',
    category: 'tumor-suppressor',
    disease: 'Most cancers',
    why: 'Guardian of the genome. R175H, R248Q, R273H are hotspots.',
  },
  {
    id: 'alk',
    pdbId: '2XP2',
    gene: 'ALK',
    name: 'Anaplastic lymphoma kinase',
    category: 'kinase',
    disease: 'Non-small cell lung cancer',
    why: 'EML4-ALK fusions. Target of crizotinib, alectinib.',
  },
  {
    id: 'abl',
    pdbId: '2HYY',
    gene: 'ABL1',
    name: 'ABL tyrosine kinase',
    category: 'kinase',
    disease: 'Chronic myeloid leukemia',
    why: 'BCR-ABL is the target of imatinib. T315I is the gatekeeper.',
  },
  {
    id: 'brca1',
    pdbId: '1JM7',
    gene: 'BRCA1',
    name: 'BRCA1 RING domain',
    category: 'tumor-suppressor',
    disease: 'Breast and ovarian cancer',
    why: 'Homologous recombination. PARP inhibitor sensitivity.',
  },
  {
    id: 'brca2',
    pdbId: '1N0W',
    gene: 'BRCA2',
    name: 'BRCA2 BRC repeat',
    category: 'tumor-suppressor',
    disease: 'Breast and ovarian cancer',
    why: 'RAD51 loading. Same PARP story as BRCA1.',
  },
  {
    id: 'pten',
    pdbId: '1D5R',
    gene: 'PTEN',
    name: 'PTEN phosphatase',
    category: 'tumor-suppressor',
    disease: 'Many cancers',
    why: 'PI3K/AKT negative regulator. Second-most mutated suppressor.',
  },
  {
    id: 'pik3ca',
    pdbId: '4JPS',
    gene: 'PIK3CA',
    name: 'PI3K alpha catalytic subunit',
    category: 'kinase',
    disease: 'Breast, colorectal cancer',
    why: 'H1047R, E545K are activating. Target of alpelisib.',
  },
  {
    id: 'jak2',
    pdbId: '4BBE',
    gene: 'JAK2',
    name: 'JAK2 kinase',
    category: 'kinase',
    disease: 'Myeloproliferative neoplasms',
    why: 'V617F drives polycythemia vera. Target of ruxolitinib.',
  },
  {
    id: 'hiv-protease',
    pdbId: '1HXB',
    gene: 'HIV-1 pol',
    name: 'HIV-1 protease',
    category: 'enzyme',
    disease: 'HIV/AIDS',
    why: 'Classic antiviral target. Resistance mutations well mapped.',
  },
  {
    id: 'sars-cov-2-mpro',
    pdbId: '6LU7',
    gene: 'ORF1ab',
    name: 'SARS-CoV-2 main protease',
    category: 'enzyme',
    disease: 'COVID-19',
    why: 'Target of nirmatrelvir (Paxlovid). Fastest-drugged viral protease.',
  },
  {
    id: 'insulin-receptor',
    pdbId: '4IBM',
    gene: 'INSR',
    name: 'Insulin receptor kinase',
    category: 'receptor',
    disease: 'Diabetes, insulin resistance',
    why: 'Classic receptor tyrosine kinase. Metabolic signaling.',
  },
  {
    id: 'glp1r',
    pdbId: '6B3J',
    gene: 'GLP1R',
    name: 'GLP-1 receptor',
    category: 'receptor',
    disease: 'Type 2 diabetes, obesity',
    why: 'Target of semaglutide. GPCR structure and drug design.',
  },
];

export function getProteinById(id: string): ProteinEntry | undefined {
  return PROTEIN_LIBRARY.find((p) => p.id === id);
}
