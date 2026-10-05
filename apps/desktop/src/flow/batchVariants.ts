import type { ParsedVariant } from './vcfParser';

/**
 * Parse a list of HGVS variants, one per line.
 *
 * Accepts:
 *   p.L858R
 *   L858R
 *   p.Leu858Arg
 *   p.L858R # activating mutation
 *
 * Lines starting with # are ignored. Blank lines are ignored.
 * Trailing notes after # are kept as the note.
 */
export function parseBatchVariants(text: string): ParsedVariant[] {
  const out: ParsedVariant[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const hashIdx = line.indexOf('#');
    const core = (hashIdx >= 0 ? line.slice(0, hashIdx) : line).trim();
    const note = hashIdx >= 0 ? line.slice(hashIdx + 1).trim() : '';

    const parsed = parseOneHgvs(core);
    if (!parsed) continue;
    out.push({
      hgvs: parsed.hgvs,
      position: parsed.position,
      ref: parsed.ref,
      alt: parsed.alt,
      kind: 'substitution',
      note: note || 'batch input',
    });
  }
  return out;
}

interface ParsedOne {
  hgvs: string;
  position: number;
  ref: string;
  alt: string;
}

const AA_THREE_TO_ONE: Record<string, string> = {
  Ala: 'A', Arg: 'R', Asn: 'N', Asp: 'D', Cys: 'C',
  Gln: 'Q', Glu: 'E', Gly: 'G', His: 'H', Ile: 'I',
  Leu: 'L', Lys: 'K', Met: 'M', Phe: 'F', Pro: 'P',
  Ser: 'S', Thr: 'T', Trp: 'W', Tyr: 'Y', Val: 'V',
};

function parseOneHgvs(input: string): ParsedOne | null {
  let s = input.trim();
  if (s.startsWith('p.')) s = s.slice(2);

  // One-letter form: L858R
  let m = s.match(/^([A-Z])(\d+)([A-Z])$/);
  if (m) {
    return { hgvs: `p.${m[1]}${m[2]}${m[3]}`, position: Number(m[2]), ref: m[1], alt: m[3] };
  }

  // Three-letter form: Leu858Arg
  m = s.match(/^([A-Za-z]{3})(\d+)([A-Za-z]{3})$/);
  if (m) {
    const from = AA_THREE_TO_ONE[capitalize(m[1])] ?? m[1][0].toUpperCase();
    const to = AA_THREE_TO_ONE[capitalize(m[3])] ?? m[3][0].toUpperCase();
    return { hgvs: `p.${from}${m[2]}${to}`, position: Number(m[2]), ref: from, alt: to };
  }

  return null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
