/**
 * Residue color palette. Standard textbook coloring.
 *
 * Hydrophobic = warm (gold/orange), polar = green, positive = blue,
 * negative = red, cysteine = bright orange (disulfides), glycine = pale.
 */
export const RESIDUE_COLORS: Record<string, number> = {
  // Hydrophobic — warm gold/orange
  A: 0xffd166,
  V: 0xffc300,
  L: 0xffb000,
  I: 0xff9e00,
  M: 0xff8c00,
  F: 0xffae00,
  W: 0xffd700,
  P: 0xffe08a,
  G: 0xf5f5dc,

  // Polar — green
  S: 0x66d9a6,
  T: 0x4dd0a1,
  Y: 0x9be36e,
  N: 0x8bd450,
  Q: 0x7ecb48,

  // Positive — blue
  K: 0x4a9eff,
  R: 0x3a7de0,
  H: 0x6bb8ff,

  // Negative — red
  D: 0xff5c5c,
  E: 0xff4747,

  // Special
  C: 0xff9f43, // cysteine: orange (disulfide-forming)
  X: 0x888888, // unknown
};

export const RESIDUE_FAMILY: Record<string, 'hydrophobic' | 'polar' | 'positive' | 'negative' | 'special'> = {
  A: 'hydrophobic', V: 'hydrophobic', L: 'hydrophobic', I: 'hydrophobic',
  M: 'hydrophobic', F: 'hydrophobic', W: 'hydrophobic', P: 'hydrophobic',
  G: 'hydrophobic',
  S: 'polar', T: 'polar', Y: 'polar', N: 'polar', Q: 'polar',
  K: 'positive', R: 'positive', H: 'positive',
  D: 'negative', E: 'negative',
  C: 'special', X: 'special',
};

export function getResidueColor(oneLetter: string): number {
  return RESIDUE_COLORS[oneLetter] ?? RESIDUE_COLORS.X;
}
