/**
 * A small library of ligands.
 *
 * Each entry has hand-placed 3D coordinates. For water and ions these are
 * exact. For small molecules (ATP, caffeine) they are APPROXIMATE shapes
 * meant to be visually recognizable, not chemically accurate. The UI
 * labels these as "simplified".
 *
 * Element colors follow CPK convention in the renderer.
 */

export type Element =
  | 'C' | 'N' | 'O' | 'S' | 'P' | 'H'
  | 'F' | 'Cl' | 'Br' | 'Zn' | 'Mg';

export interface LigandAtom {
  element: Element;
  x: number;
  y: number;
  z: number;
}

export interface LigandBond {
  a: number;
  b: number;
}

export interface LigandEntry {
  id: string;
  name: string;
  formula: string;
  category: 'ion' | 'cofactor' | 'drug' | 'fragment';
  target: string;
  notes: string;
  approximate: boolean;
  atoms: LigandAtom[];
  bonds: LigandBond[];
}

export const LIGAND_LIBRARY: LigandEntry[] = [
  {
    id: 'water',
    name: 'Water',
    formula: 'H2O',
    category: 'fragment',
    target: 'universal',
    notes: 'Solvent. Used to probe pockets.',
    approximate: false,
    atoms: [
      { element: 'O', x: 0, y: 0, z: 0 },
      { element: 'H', x: 0.96, y: 0, z: 0 },
      { element: 'H', x: -0.24, y: 0.93, z: 0 },
    ],
    bonds: [{ a: 0, b: 1 }, { a: 0, b: 2 }],
  },
  {
    id: 'mg2',
    name: 'Magnesium ion',
    formula: 'Mg2+',
    category: 'ion',
    target: 'kinases, ATP-binding sites',
    notes: 'Essential cofactor for phosphoryl transfer.',
    approximate: false,
    atoms: [{ element: 'Mg', x: 0, y: 0, z: 0 }],
    bonds: [],
  },
  {
    id: 'zn2',
    name: 'Zinc ion',
    formula: 'Zn2+',
    category: 'ion',
    target: 'zinc fingers, metalloenzymes',
    notes: 'Structural and catalytic. Tetrahedral coordination.',
    approximate: false,
    atoms: [{ element: 'Zn', x: 0, y: 0, z: 0 }],
    bonds: [],
  },
  {
    id: 'atp',
    name: 'ATP',
    formula: 'C10H16N5O13P3',
    category: 'cofactor',
    target: 'kinases',
    notes: 'Adenosine triphosphate. Shape is simplified, not real geometry.',
    approximate: true,
    atoms: [
      // Purine ring
      { element: 'N', x: -1.4, y: 0.0, z: 0 },
      { element: 'C', x: -0.7, y: 1.2, z: 0 },
      { element: 'N', x: 0.7, y: 1.2, z: 0 },
      { element: 'C', x: 1.4, y: 0.0, z: 0 },
      { element: 'C', x: 0.7, y: -1.2, z: 0 },
      { element: 'C', x: -0.7, y: -1.2, z: 0 },
      // Ribose
      { element: 'C', x: -2.4, y: -1.2, z: 0.4 },
      { element: 'C', x: -3.4, y: 0.0, z: 0.4 },
      { element: 'O', x: -4.4, y: -0.5, z: 0.4 },
      // Phosphate tail
      { element: 'P', x: -5.4, y: 0.3, z: 0.4 },
      { element: 'P', x: -6.4, y: 0.9, z: 0.4 },
      { element: 'P', x: -7.4, y: 1.5, z: 0.4 },
    ],
    bonds: [
      { a: 0, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 },
      { a: 3, b: 4 }, { a: 4, b: 5 }, { a: 5, b: 0 },
      { a: 5, b: 6 }, { a: 6, b: 7 }, { a: 7, b: 8 },
      { a: 8, b: 9 }, { a: 9, b: 10 }, { a: 10, b: 11 },
    ],
  },
  {
    id: 'caffeine',
    name: 'Caffeine',
    formula: 'C8H10N4O2',
    category: 'drug',
    target: 'adenosine receptor',
    notes: 'Shape is simplified, not real geometry.',
    approximate: true,
    atoms: [
      { element: 'N', x: -1.4, y: 0.0, z: 0 },
      { element: 'C', x: -0.7, y: 1.2, z: 0 },
      { element: 'N', x: 0.7, y: 1.2, z: 0 },
      { element: 'C', x: 1.4, y: 0.0, z: 0 },
      { element: 'C', x: 0.7, y: -1.2, z: 0 },
      { element: 'N', x: -0.7, y: -1.2, z: 0 },
      { element: 'O', x: 2.6, y: 0.3, z: 0 },
      { element: 'O', x: 1.3, y: -2.4, z: 0 },
      { element: 'C', x: -2.6, y: 0.3, z: 0 },
      { element: 'C', x: 1.3, y: 2.4, z: 0 },
    ],
    bonds: [
      { a: 0, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 },
      { a: 3, b: 4 }, { a: 4, b: 5 }, { a: 5, b: 0 },
      { a: 3, b: 6 }, { a: 4, b: 7 },
      { a: 0, b: 8 }, { a: 2, b: 9 },
    ],
  },
];

export function getLigandById(id: string): LigandEntry | undefined {
  return LIGAND_LIBRARY.find((l) => l.id === id);
}

export const ELEMENT_COLORS: Record<Element, number> = {
  C: 0x555555,
  N: 0x3050f8,
  O: 0xff2020,
  S: 0xffff30,
  P: 0xff8000,
  H: 0xf0f0f0,
  F: 0x90e050,
  Cl: 0x1ff01f,
  Br: 0xa62929,
  Zn: 0x7d80b0,
  Mg: 0x8aff00,
};

export const ELEMENT_RADII: Record<Element, number> = {
  C: 0.5, N: 0.5, O: 0.5, S: 0.6, P: 0.6, H: 0.35,
  F: 0.45, Cl: 0.6, Br: 0.65, Zn: 0.8, Mg: 0.7,
};
