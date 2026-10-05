import { serializeGraph, deserializeGraph } from './graphSerialization';
import type { NodeInstance, EdgeInstance } from './NodeEditor';

const KEY = 'genesis.flow.graph.v1';
const AUTOSAVE_DELAY_MS = 400;

let timer: number | null = null;

export function autosaveGraph(
  nodes: NodeInstance[],
  edges: EdgeInstance[]
): void {
  if (typeof window === 'undefined') return;
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    try {
      const payload = JSON.stringify(serializeGraph(nodes, edges));
      window.localStorage.setItem(KEY, payload);
    } catch {
      // Storage might be disabled; ignore.
    }
  }, AUTOSAVE_DELAY_MS);
}

export function loadAutosavedGraph(): {
  nodes: NodeInstance[];
  edges: EdgeInstance[];
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return deserializeGraph(raw);
  } catch {
    return null;
  }
}

export function clearAutosavedGraph(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
