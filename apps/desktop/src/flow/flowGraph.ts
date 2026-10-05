export interface FlowNodeDef {
  id: string;
  x: number;
  y: number;
  label: string;
  subtitle: string;
  kind: 'load' | 'variants' | 'predict' | 'rank';
}

export interface FlowEdgeDef {
  id: string;
  from: string;
  to: string;
}

/**
 * The v1 demo pipeline: Load EGFR -> Curated variants -> Predict
 * stability -> Rank by ΔΔG.
 *
 * Fixed positions. Fixed topology. This is the demo graph from V1_DEMO.md.
 * Node editing is Phase 2.
 */
export const FLOW_NODES: FlowNodeDef[] = [
  { id: 'load',     x: 80,  y: 120, label: 'Load EGFR',       subtitle: '4HJO · kinase domain',   kind: 'load' },
  { id: 'variants', x: 340, y: 120, label: 'Curated variants', subtitle: '25 EGFR mutations',      kind: 'variants' },
  { id: 'predict',  x: 600, y: 120, label: 'Predict stability', subtitle: 'Stub engine v0.0.1',    kind: 'predict' },
  { id: 'rank',     x: 860, y: 120, label: 'Rank',             subtitle: 'by ΔΔG ascending',      kind: 'rank' },
];

export const FLOW_EDGES: FlowEdgeDef[] = [
  { id: 'e1', from: 'load',     to: 'variants' },
  { id: 'e2', from: 'variants', to: 'predict' },
  { id: 'e3', from: 'predict',  to: 'rank' },
];

export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 80;
