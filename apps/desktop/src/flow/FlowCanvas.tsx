import { FLOW_NODES, FLOW_EDGES, NODE_WIDTH, NODE_HEIGHT, type FlowNodeDef } from './flowGraph';

export interface FlowCanvasProps {
  activeNodeId: string | null;
}

export function FlowCanvas({ activeNodeId }: FlowCanvasProps) {
  const byId = new Map(FLOW_NODES.map((n) => [n.id, n]));

  return (
    <div className="flow-canvas">
      <svg
        className="flow-edges"
        width="1200"
        height="400"
        viewBox="0 0 1200 400"
      >
        {FLOW_EDGES.map((e) => {
          const src = byId.get(e.from)!;
          const tgt = byId.get(e.to)!;
          const x1 = src.x + NODE_WIDTH;
          const y1 = src.y + NODE_HEIGHT / 2;
          const x2 = tgt.x;
          const y2 = tgt.y + NODE_HEIGHT / 2;
          const mid = (x1 + x2) / 2;
          const d = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
          const isActive =
            activeNodeId === e.from || activeNodeId === e.to;
          return (
            <path
              key={e.id}
              d={d}
              fill="none"
              stroke={isActive ? '#66ccff' : '#2a3a44'}
              strokeWidth={isActive ? 2 : 1.5}
            />
          );
        })}
      </svg>

      {FLOW_NODES.map((n) => (
        <FlowNode key={n.id} node={n} active={activeNodeId === n.id} />
      ))}
    </div>
  );
}

function FlowNode({ node, active }: { node: FlowNodeDef; active: boolean }) {
  return (
    <div
      className={`flow-node ${active ? 'active' : ''}`}
      style={{ left: node.x, top: node.y }}
    >
      <div className="flow-node-kind">{node.kind}</div>
      <div className="flow-node-label">{node.label}</div>
      <div className="flow-node-subtitle">{node.subtitle}</div>
    </div>
  );
}
