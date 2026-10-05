export interface CAAtom {
  x: number;
  y: number;
  z: number;
  residueNumber: number;
  residueName: string;
  residueOneLetter: string;
}

export type PDBSource = 'local' | 'rcsb';

export interface LoadedPDB {
  text: string;
  source: PDBSource;
}

const THREE_TO_ONE: Record<string, string> = {
  ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C',
  GLN: 'Q', GLU: 'E', GLY: 'G', HIS: 'H', ILE: 'I',
  LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P',
  SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
};

export function parsePDBCA(text: string): CAAtom[] {
  const atoms: CAAtom[] = [];
  const seen = new Set<number>();

  for (const line of text.split('\n')) {
    if (!line.startsWith('ATOM')) continue;
    if (line.substring(12, 16).trim() !== 'CA') continue;

    const resName = line.substring(17, 20).trim();
    const resSeq = parseInt(line.substring(22, 26), 10);
    if (!Number.isFinite(resSeq) || seen.has(resSeq)) continue;

    const x = parseFloat(line.substring(30, 38));
    const y = parseFloat(line.substring(38, 46));
    const z = parseFloat(line.substring(46, 54));
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;

    seen.add(resSeq);
    atoms.push({
      x, y, z,
      residueNumber: resSeq,
      residueName: resName,
      residueOneLetter: THREE_TO_ONE[resName] ?? 'X',
    });
  }
  return atoms;
}

export function centerAtoms(atoms: CAAtom[]): CAAtom[] {
  if (atoms.length === 0) return atoms;
  let cx = 0, cy = 0, cz = 0;
  for (const a of atoms) { cx += a.x; cy += a.y; cz += a.z; }
  cx /= atoms.length; cy /= atoms.length; cz /= atoms.length;
  return atoms.map((a) => ({ ...a, x: a.x - cx, y: a.y - cy, z: a.z - cz }));
}

/**
 * Load a PDB file.
 *
 * Tries the bundled copy first (apps/desktop/public/<id>.pdb). If that
 * 404s, falls back to RCSB. The source is returned so the UI can say
 * whether the demo ran offline or over the network.
 *
 * To prime the local cache, run: bash scripts/fetch-pdb.sh 4HJO
 */
export async function loadPDB(pdbId: string): Promise<LoadedPDB> {
  const localUrl = `${import.meta.env.BASE_URL}${pdbId}.pdb`;
  try {
    const local = await fetch(localUrl);
    if (local.ok) {
      const text = await local.text();
      if (text.startsWith('HEADER') || text.startsWith('ATOM')) {
        return { text, source: 'local' };
      }
    }
  } catch {
    // fall through to RCSB
  }

  const remote = await fetch(`https://files.rcsb.org/download/${pdbId}.pdb`);
  if (!remote.ok) throw new Error(`RCSB returned ${remote.status} for ${pdbId}`);
  return { text: await remote.text(), source: 'rcsb' };
}
