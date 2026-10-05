const DEFAULT_URL = 'http://127.0.0.1:8765';

export interface DockInput {
  pdbId: string;
  proteinAtomIndex: number;
  ligandId: string;
  ligandAtomIndex: number;
  ligandX: number;
  ligandY: number;
  ligandZ: number;
  proteinX: number;
  proteinY: number;
  proteinZ: number;
}

export interface DockResult {
  distanceAngstrom: number;
  estimatedKdNm: number;
  method: string;
  methodVersion: string;
  notes: string;
}

/**
 * Ask the Python sidecar to score a docking pose.
 *
 * If the sidecar is running with a real docking backend (AutoDock Vina),
 * the score is real. If not, the sidecar's stub returns a geometric
 * estimate. The UI labels which one produced the number.
 */
export async function dockWithSidecar(
  input: DockInput,
  baseUrl: string = DEFAULT_URL,
  timeoutMs = 15000
): Promise<DockResult | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${baseUrl}/dock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as DockResult;
  } catch {
    return null;
  }
}

/**
 * Local geometric fallback. Used when the sidecar is absent.
 * Deterministic. Not science.
 */
export function localGeometricDock(
  distanceAngstrom: number,
): DockResult {
  const optimal = 3.5;
  const sigma = 1.5;
  const score = Math.exp(-((distanceAngstrom - optimal) ** 2) / (2 * sigma * sigma));
  const kdNm = 10 * Math.pow(10000, 1 - score);
  return {
    distanceAngstrom,
    estimatedKdNm: kdNm,
    method: 'Local geometric stub',
    methodVersion: '0.0.1',
    notes: 'Not a real docking score. Start the Python sidecar for better estimates.',
  };
}
