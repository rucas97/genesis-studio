export interface ParsedVariant {
  hgvs: string;
  position: number;
  ref: string;
  alt: string;
  kind: 'substitution' | 'deletion' | 'insertion';
  note: string;
}

/**
 * Parse a minimal VCF. Extracts CHROM, POS, REF, ALT and, if present,
 * HGVS protein notation from the INFO field (e.g. HGVSp or HGVS.p).
 *
 * This is not a full VCF parser. It handles the common case: a single
 * sample, one ALT per row, optional HGVS in INFO. Multi-allelic rows are
 * split into separate variants.
 */
export function parseVCF(text: string): ParsedVariant[] {
  const variants: ParsedVariant[] = [];
  const lines = text.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const cols = line.split('\t');
    if (cols.length < 5) continue;
    const [, posStr, ref, altField, infoField] = cols;
    const pos = parseInt(posStr, 10);
    if (!Number.isFinite(pos)) continue;

    const alts = altField.split(',');
    const info = infoField ?? '';

    for (const alt of alts) {
      const kind = classify(ref, alt);
      const hgvsFromInfo = extractHgvs(info);
      const hgvs = hgvsFromInfo ?? `g.${pos}${ref}>${alt}`;
      variants.push({
        hgvs,
        position: pos,
        ref,
        alt,
        kind,
        note: `VCF pos ${pos}`,
      });
    }
  }
  return variants;
}

function classify(ref: string, alt: string): 'substitution' | 'deletion' | 'insertion' {
  if (ref.length === alt.length && ref.length === 1) return 'substitution';
  if (ref.length > alt.length) return 'deletion';
  return 'insertion';
}

function extractHgvs(info: string): string | null {
  // Look for HGVSp= or HGVS.p= in the INFO field.
  const m = info.match(/(?:HGVSp|HGVS\.p)=([^;]+)/i);
  if (!m) return null;
  const raw = decodeURIComponent(m[1]);
  // HGVSp is often written as p.Leu858Arg — convert to one-letter if possible.
  return normalizeHgvs(raw);
}

const AA_THREE_TO_ONE: Record<string, string> = {
  Ala: 'A', Arg: 'R', Asn: 'N', Asp: 'D', Cys: 'C',
  Gln: 'Q', Glu: 'E', Gly: 'G', His: 'H', Ile: 'I',
  Leu: 'L', Lys: 'K', Met: 'M', Phe: 'F', Pro: 'P',
  Ser: 'S', Thr: 'T', Trp: 'W', Tyr: 'Y', Val: 'V',
};

function normalizeHgvs(hgvs: string): string {
  // Convert p.Leu858Arg → p.L858R
  const m = hgvs.match(/^p\.([A-Za-z]{3})(\d+)([A-Za-z]{3})$/);
  if (m) {
    const from = AA_THREE_TO_ONE[m[1]] ?? m[1];
    const to = AA_THREE_TO_ONE[m[3]] ?? m[3];
    return `p.${from}${m[2]}${to}`;
  }
  return hgvs;
}
