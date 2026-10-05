export interface CAAtom {
  x: number;
  y: number;
  z: number;
}

/**
 * Parse alpha-carbon coordinates from a PDB file.
 *
 * PDB format is fixed-column. ATOM lines are 80 chars wide:
 *   cols 13-16 = atom name
 *   cols 31-38 = x
 *   cols 39-46 = y
 *   cols 47-54 = z
 *
 * We only need CA atoms for a backbone trace. This is not a general parser.
 */
export function parsePDBCA(text: string): CAAtom[] {
  const atoms: CAAtom[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    if (!line.startsWith('ATOM')) continue;
    const atomName = line.substring(12, 16).trim();
    if (atomName !== 'CA') continue;
    const x = parseFloat(line.substring(30, 38));
    const y = parseFloat(line.substring(38, 46));
    const z = parseFloat(line.substring(46, 54));
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      atoms.push({ x, y, z });
    }
  }
  return atoms;
}

/** Translate a set of atoms so the centroid is at the origin. */
export function centerAtoms(atoms: CAAtom[]): CAAtom[] {
  if (atoms.length === 0) return atoms;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const a of atoms) {
    cx += a.x;
    cy += a.y;
    cz += a.z;
  }
  cx /= atoms.length;
  cy /= atoms.length;
  cz /= atoms.length;
  return atoms.map((a) => ({ x: a.x - cx, y: a.y - cy, z: a.z - cz }));
}

export async function fetchPDB(pdbId: string): Promise<string> {
  const url = `https://files.rcsb.org/download/${pdbId}.pdb`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`RCSB returned ${res.status} for ${pdbId}`);
  return res.text();
}
