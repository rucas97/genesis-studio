/**
 * A curated set of EGFR variants for the demo pipeline.
 *
 * Source: known clinical EGFR mutations (exon 18 sensitizing, exon 19
 * deletions, exon 20 insertions, exon 21 activating, resistance mutations).
 *
 * This is NOT a ClinVar dump. It is a small hand-curated list for the demo.
 * A real build will import from ClinGen / ClinVar / gnomAD. See V1_DEMO.md.
 */

export type EGFRVariantKind = 'substitution' | 'deletion' | 'insertion';

export interface EGFRVariant {
  hgvs: string;
  position: number;
  ref: string;
  alt: string;
  kind: EGFRVariantKind;
  note: string;
}

export const EGFR_VARIANTS: EGFRVariant[] = [
  // Exon 18 — sensitizing
  { hgvs: 'p.G719S', position: 719, ref: 'G', alt: 'S', kind: 'substitution', note: 'Exon 18, sensitizing' },
  { hgvs: 'p.G719A', position: 719, ref: 'G', alt: 'A', kind: 'substitution', note: 'Exon 18, sensitizing' },
  { hgvs: 'p.G719C', position: 719, ref: 'G', alt: 'C', kind: 'substitution', note: 'Exon 18, sensitizing' },
  { hgvs: 'p.E709K', position: 709, ref: 'E', alt: 'K', kind: 'substitution', note: 'Exon 18' },
  { hgvs: 'p.L718V', position: 718, ref: 'L', alt: 'V', kind: 'substitution', note: 'Exon 18' },
  { hgvs: 'p.L718Q', position: 718, ref: 'L', alt: 'Q', kind: 'substitution', note: 'Exon 18, resistance' },

  // Exon 19 — deletions
  { hgvs: 'p.E746_A750del', position: 746, ref: 'E_A', alt: 'del', kind: 'deletion', note: 'Exon 19 deletion, sensitizing' },
  { hgvs: 'p.L747_P753delinsS', position: 747, ref: 'L_P', alt: 'delinsS', kind: 'deletion', note: 'Exon 19 deletion' },
  { hgvs: 'p.L747_T751del', position: 747, ref: 'L_T', alt: 'del', kind: 'deletion', note: 'Exon 19 deletion' },
  { hgvs: 'p.E746_T751delinsA', position: 746, ref: 'E_T', alt: 'delinsA', kind: 'deletion', note: 'Exon 19 deletion' },
  { hgvs: 'p.L747S', position: 747, ref: 'L', alt: 'S', kind: 'substitution', note: 'Exon 19, resistance to osimertinib' },
  { hgvs: 'p.L747P', position: 747, ref: 'L', alt: 'P', kind: 'substitution', note: 'Exon 19, resistance' },

  // Exon 20 — insertions
  { hgvs: 'p.A763_Y764insFQEA', position: 763, ref: 'A_Y', alt: 'insFQEA', kind: 'insertion', note: 'Exon 20 insertion, rare' },
  { hgvs: 'p.D770_N771insSVD', position: 770, ref: 'D_N', alt: 'insSVD', kind: 'insertion', note: 'Exon 20 insertion, resistant' },
  { hgvs: 'p.H773_V774insNPH', position: 773, ref: 'H_V', alt: 'insNPH', kind: 'insertion', note: 'Exon 20 insertion' },
  { hgvs: 'p.V774_C775insHV', position: 774, ref: 'V_C', alt: 'insHV', kind: 'insertion', note: 'Exon 20 insertion' },

  // Exon 21 — activating and resistance
  { hgvs: 'p.L858R', position: 858, ref: 'L', alt: 'R', kind: 'substitution', note: 'Exon 21, activating' },
  { hgvs: 'p.L861Q', position: 861, ref: 'L', alt: 'Q', kind: 'substitution', note: 'Exon 21, sensitizing' },
  { hgvs: 'p.L861R', position: 861, ref: 'L', alt: 'R', kind: 'substitution', note: 'Exon 21, rare' },
  { hgvs: 'p.T854A', position: 854, ref: 'T', alt: 'A', kind: 'substitution', note: 'Exon 21, resistance' },

  // Gatekeeper and covalent-site resistance
  { hgvs: 'p.T790M', position: 790, ref: 'T', alt: 'M', kind: 'substitution', note: 'Gatekeeper, resistance to 1st/2nd gen TKIs' },
  { hgvs: 'p.C797S', position: 797, ref: 'C', alt: 'S', kind: 'substitution', note: 'Covalent inhibitor resistance' },
  { hgvs: 'p.G724S', position: 724, ref: 'G', alt: 'S', kind: 'substitution', note: 'Exon 18, resistance to osimertinib' },
  { hgvs: 'p.S768I', position: 768, ref: 'S', alt: 'I', kind: 'substitution', note: 'Exon 20, rare' },
  { hgvs: 'p.V769M', position: 769, ref: 'V', alt: 'M', kind: 'substitution', note: 'Exon 20, rare' },
];
