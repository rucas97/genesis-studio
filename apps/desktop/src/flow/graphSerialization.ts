import type { NodeInstance, EdgeInstance } from './NodeEditor';

export const GRAPH_SCHEMA_VERSION = 1;

export interface SerializedGraph {
  schema: number;
  savedAt: string;
  app: 'genesis-studio';
  nodes: NodeInstance[];
  edges: EdgeInstance[];
}

export function serializeGraph(
  nodes: NodeInstance[],
  edges: EdgeInstance[]
): SerializedGraph {
  return {
    schema: GRAPH_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    app: 'genesis-studio',
    nodes,
    edges,
  };
}

export function deserializeGraph(
  raw: string
): { nodes: NodeInstance[]; edges: EdgeInstance[] } {
  const parsed = JSON.parse(raw) as SerializedGraph;
  if (parsed.app !== 'genesis-studio') {
    throw new Error('Not a GENESIS Studio graph file');
  }
  if (parsed.schema !== GRAPH_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported graph schema ${parsed.schema} (expected ${GRAPH_SCHEMA_VERSION})`
    );
  }
  if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error('Graph file missing nodes or edges');
  }
  return { nodes: parsed.nodes, edges: parsed.edges };
}

export function downloadGraph(
  nodes: NodeInstance[],
  edges: EdgeInstance[],
  filename = 'genesis-flow.json'
): void {
  const json = JSON.stringify(serializeGraph(nodes, edges), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
