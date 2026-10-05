const UNIPROT_BASE = 'https://rest.uniprot.org/uniprotkb';

export interface UniProtSequence {
  uniprotId: string;
  accession: string;
  name: string;
  sequence: string;
  length: number;
  fetchedAt: string;
}

/**
 * Fetch a protein sequence from UniProt's REST API.
 *
 * Returns null on any error (network, 404, malformed response). Callers
 * should handle the null case — the tool works offline, but this
 * particular feature requires network.
 */
export async function fetchUniProtSequence(
  uniprotId: string,
  timeoutMs = 8000
): Promise<UniProtSequence | null> {
  if (!uniprotId || !/^[A-Z0-9]{6,10}$/i.test(uniprotId.trim())) {
    return null;
  }
  const id = uniprotId.trim().toUpperCase();

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${UNIPROT_BASE}/${id}.fasta`, {
      signal: controller.signal,
      headers: { Accept: 'text/plain' },
    });
    clearTimeout(t);
    if (!res.ok) return null;

    const text = await res.text();
    const lines = text.split('\n');
    const header = lines[0] ?? '';
    const sequence = lines.slice(1).join('').replace(/\s/g, '').trim();
    if (!sequence) return null;

    // Header format: >sp|P00533|EGFR_HUMAN Epidermal growth factor receptor
    const parts = header.slice(1).split('|');
    const accession = parts[1] ?? id;
    const afterPipe = parts[2] ?? '';
    const name = afterPipe.split(' ').slice(1).join(' ') || afterPipe;

    return {
      uniprotId: id,
      accession,
      name: name.trim() || id,
      sequence,
      length: sequence.length,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
