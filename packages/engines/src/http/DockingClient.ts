const DEFAULT_URL = 'http://127.0.0.1:8765';

export interface DockRequest {
  pdbId: string;
  ligandId: string;
  ligandSmiles: string;
  /** Point on the protein, in Angstroms. Used as the search box center. */
  center: { x: number; y: number; z: number };
  /** Box edge length in Angstroms. */
  boxSize?: number;
  /** Only used by the stub runner as a geometric distance fallback. */
  ligandPoint: { x: number; y: number; z: number };
}

export interface DockResult {
  distanceAngstrom: number | null;
  estimatedKdNm: number;
  bindingEnergyKcal: number | null;
  method: string;
  methodVersion: string;
  notes: string;
}

export async function dockWithSidecar(
  req: DockRequest,
  baseUrl: string = DEFAULT_URL,
  timeoutMs = 300000 // 5 min for real Vina
): Promise<DockResult | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${baseUrl}/dock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as DockResult;
  } catch {
    return null;
  }
}

/** Local fallback. Deterministic. Not science. */
export function localGeometricDock(distanceAngstrom: number): DockResult {
  const optimal = 3.5;
  const sigma = 1.5;
  const score = Math.exp(-((distanceAngstrom - optimal) ** 2) / (2 * sigma * sigma));
  const kdNm = 10 * Math.pow(10000, 1 - score);
  return {
    distanceAngstrom,
    estimatedKdNm: kdNm,
    bindingEnergyKcal: null,
    method: 'Local geometric stub',
    methodVersion: '0.0.1',
    notes: 'Not a real docking score. Start the Python sidecar for better estimates.',
  };
}
