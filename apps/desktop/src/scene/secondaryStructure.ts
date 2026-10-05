import type { CAAtom } from './pdbLoader';

export type SecondaryStructure = 'helix' | 'sheet' | 'coil';

const HELIX_DIST = 6.5;   // CA(i) to CA(i+4) distance for alpha helix
const SHEET_MIN = 9.0;    // CA(i) to CA(i+3) distance lower bound for beta
const SHEET_MAX = 11.0;

/**
 * Approximate secondary structure assignment from CA-CA distances.
 *
 * Not DSSP. Not accurate at boundaries. Good enough to make the cartoon
 * visually indicate helices and strands.
 *
 * Helix rule: CA(i) to CA(i+4) < 6.5 Å.
 * Sheet rule: CA(i) to CA(i+3) in [9, 11] Å and not part of a helix.
 * Everything else is coil.
 */
export function assignSecondaryStructure(atoms: CAAtom[]): SecondaryStructure[] {
  const n = atoms.length;
  const ss: SecondaryStructure[] = new Array(n).fill('coil');
  if (n < 5) return ss;

  const dist = (a: CAAtom, b: CAAtom) =>
    Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

  // Helix
  for (let i = 0; i + 4 < n; i++) {
    if (dist(atoms[i], atoms[i + 4]) < HELIX_DIST) {
      for (let k = 0; k <= 4; k++) ss[i + k] = 'helix';
    }
  }

  // Sheet (only for positions not already helix)
  for (let i = 0; i + 3 < n; i++) {
    if (ss[i] === 'helix' || ss[i + 3] === 'helix') continue;
    const d = dist(atoms[i], atoms[i + 3]);
    if (d >= SHEET_MIN && d <= SHEET_MAX) {
      for (let k = 0; k <= 3; k++) {
        if (ss[i + k] !== 'helix') ss[i + k] = 'sheet';
      }
    }
  }

  return ss;
}

export function ssSize(ss: SecondaryStructure): number {
  if (ss === 'helix') return 0.95;
  if (ss === 'sheet') return 0.75;
  return 0.55;
}
