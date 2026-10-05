import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { NODE_TYPES, CATEGORY_COLORS } from './nodeTypes';

export interface NodeInstance {
  id: string;
  type: string;
  x: number;
  y: number;
  params: Record<string, unknown>;
}

export interface EdgeInstance {
  id: string;
  from: { nodeId: string; portId: string };
  to: { nodeId: string; portId: string };
}

export interface NodeEditorProps {
  nodes: NodeInstance[];
  edges: EdgeInstance[];
  onChange: (nodes: NodeInstance[], edges: EdgeInstance[]) => void;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  activeNodeIds?: string[];
  onRun?: () => void;
  running?: boolean;
}

export const NODE_WIDTH = 200;
export const HEADER_HEIGHT = 44;
export const PORT_ROW_HEIGHT = 24;
export const PORT_PADDING = 8;

export function getPortPosition(
  node: NodeInstance,
  side: 'in' | 'out',
  index: number
): { x: number; y: number } {
  const y =
    node.y +
    HEADER_HEIGHT +
    PORT_PADDING +
    PORT_ROW_HEIGHT * index +
    PORT_ROW_HEIGHT / 2;
  const x = side === 'in' ? node.x : node.x + NODE_WIDTH;
  return { x, y };
}

export function getNodeHeight(typeKey: string): number {
  const t = NODE_TYPES[typeKey];
  if (!t) return HEADER_HEIGHT + 32;
  const rows = Math.max(t.inputs.length, t.outputs.length, 1);
  return HEADER_HEIGHT + PORT_PADDING * 2 + rows * PORT_ROW_HEIGHT;
}

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export function createNode(typeKey: string, x: number, y: number): NodeInstance {
  const def = NODE_TYPES[typeKey];
  const params: Record<string, unknown> = {};
  if (def?.params) for (const p of def.params) params[p.key] = p.default;
  return { id: nextId('n'), type: typeKey, x, y, params };
}

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

type Interaction =
  | { kind: 'node'; nodeId: string; offsetX: number; offsetY: number }
  | { kind: 'pan'; startX: number; startY: number; vpX: number; vpY: number }
  | {
      kind: 'connect';
      fromNodeId: string;
      fromPortId: string;
      fromSide: 'in' | 'out';
      cursorScreen: { x: number; y: number };
    }
  | null;

export function NodeEditor({
  nodes,
  edges,
  onChange,
  selectedNodeId,
  onSelectNode,
  activeNodeIds,
  onRun,
  running,
}: NodeEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 40, y: 40, zoom: 1 });
  const [interaction, setInteraction] = useState<Interaction>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const activeSet = new Set(activeNodeIds ?? []);

  const screenToWorld = useCallback(
    (sx: number, sy: number) => {
      const rect = containerRef.current!.getBoundingClientRect();
      return {
        x: (sx - rect.left - viewport.x) / viewport.zoom,
        y: (sy - rect.top - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  const onNodePointerDown = (e: ReactPointerEvent, nodeId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const world = screenToWorld(e.clientX, e.clientY);
    onSelectNode(nodeId);
    setInteraction({
      kind: 'node',
      nodeId,
      offsetX: world.x - node.x,
      offsetY: world.y - node.y,
    });
  };

  const onPortPointerDown = (
    e: ReactPointerEvent,
    nodeId: string,
    portId: string,
    side: 'in' | 'out'
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setInteraction({
      kind: 'connect',
      fromNodeId: nodeId,
      fromPortId: portId,
      fromSide: side,
      cursorScreen: { x: e.clientX, y: e.clientY },
    });
  };

  const onCanvasPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (e.target !== e.currentTarget) return;
    onSelectNode(null);
    setInteraction({
      kind: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      vpX: viewport.x,
      vpY: viewport.y,
    });
  };

  useEffect(() => {
    if (!interaction) return;

    const onMove = (e: PointerEvent) => {
      if (interaction.kind === 'node') {
        const world = screenToWorld(e.clientX, e.clientY);
        const nx = world.x - interaction.offsetX;
        const ny = world.y - interaction.offsetY;
        const next = nodes.map((n) =>
          n.id === interaction.nodeId ? { ...n, x: nx, y: ny } : n
        );
        onChange(next, edges);
      } else if (interaction.kind === 'pan') {
        setViewport((v) => ({
          ...v,
          x: interaction.vpX + (e.clientX - interaction.startX),
          y: interaction.vpY + (e.clientY - interaction.startY),
        }));
      } else if (interaction.kind === 'connect') {
        setInteraction({
          ...interaction,
          cursorScreen: { x: e.clientX, y: e.clientY },
        });
      }
    };

    const onUp = (e: PointerEvent) => {
      if (interaction.kind === 'connect') {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const portEl = el?.closest('[data-port-node]') as HTMLElement | null;
        if (portEl) {
          const tNode = portEl.dataset.portNode!;
          const tPort = portEl.dataset.portId!;
          const tSide = portEl.dataset.portSide as 'in' | 'out';
          if (tNode !== interaction.fromNodeId && tSide !== interaction.fromSide) {
            const fromNodeId =
              interaction.fromSide === 'out' ? interaction.fromNodeId : tNode;
            const fromPortId =
              interaction.fromSide === 'out' ? interaction.fromPortId : tPort;
            const toNodeId =
              interaction.fromSide === 'out' ? tNode : interaction.fromNodeId;
            const toPortId =
              interaction.fromSide === 'out' ? tPort : interaction.fromPortId;
            const exists = edges.some(
              (ed) =>
                ed.from.nodeId === fromNodeId &&
                ed.from.portId === fromPortId &&
                ed.to.nodeId === toNodeId &&
                ed.to.portId === toPortId
            );
            if (!exists) {
              onChange(nodes, [
                ...edges,
                {
                  id: nextId('e'),
                  from: { nodeId: fromNodeId, portId: fromPortId },
                  to: { nodeId: toNodeId, portId: toPortId },
                },
              ]);
            }
          }
        }
      }
      setInteraction(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [interaction, nodes, edges, onChange, screenToWorld]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = -e.deltaY * 0.0015;
    const newZoom = Math.min(2.5, Math.max(0.3, viewport.zoom * (1 + delta)));
    const wx = (mx - viewport.x) / viewport.zoom;
    const wy = (my - viewport.y) / viewport.zoom;
    setViewport({
      x: mx - wx * newZoom,
      y: my - wy * newZoom,
      zoom: newZoom,
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        const nextNodes = nodes.filter((n) => n.id !== selectedNodeId);
        const nextEdges = edges.filter(
          (ed) =>
            ed.from.nodeId !== selectedNodeId && ed.to.nodeId !== selectedNodeId
        );
        onChange(nextNodes, nextEdges);
        onSelectNode(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedNodeId, nodes, edges, onChange, onSelectNode]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const typeKey = e.dataTransfer.getData('application/x-genesis-node');
    if (!typeKey || !NODE_TYPES[typeKey]) return;
    const world = screenToWorld(e.clientX, e.clientY);
    const node = createNode(
      typeKey,
      world.x - NODE_WIDTH / 2,
      world.y - HEADER_HEIGHT / 2
    );
    onChange([...nodes, node], edges);
    onSelectNode(node.id);
  };

  const edgePath = useCallback(
    (from: EdgeInstance['from'], to: EdgeInstance['to']): string | null => {
      const fn = nodes.find((n) => n.id === from.nodeId);
      const tn = nodes.find((n) => n.id === to.nodeId);
      if (!fn || !tn) return null;
      const fd = NODE_TYPES[fn.type];
      const td = NODE_TYPES[tn.type];
      if (!fd || !td) return null;
      const oi = fd.outputs.findIndex((p) => p.id === from.portId);
      const ii = td.inputs.findIndex((p) => p.id === to.portId);
      if (oi < 0 || ii < 0) return null;
      const a = getPortPosition(fn, 'out', oi);
      const b = getPortPosition(tn, 'in', ii);
      const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
      return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
    },
    [nodes]
  );

  const previewPath = (() => {
    if (!interaction || interaction.kind !== 'connect') return null;
    const fromNode = nodes.find((n) => n.id === interaction.fromNodeId);
    if (!fromNode) return null;
    const def = NODE_TYPES[fromNode.type];
    const idx =
      interaction.fromSide === 'out'
        ? def.outputs.findIndex((p) => p.id === interaction.fromPortId)
        : def.inputs.findIndex((p) => p.id === interaction.fromPortId);
    if (idx < 0) return null;
    const a = getPortPosition(fromNode, interaction.fromSide, idx);
    const world = screenToWorld(
      interaction.cursorScreen.x,
      interaction.cursorScreen.y
    );
    const dx = Math.max(40, Math.abs(world.x - a.x) * 0.5);
    if (interaction.fromSide === 'out') {
      return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${world.x - dx} ${world.y}, ${world.x} ${world.y}`;
    }
    return `M ${a.x} ${a.y} C ${a.x - dx} ${a.y}, ${world.x + dx} ${world.y}, ${world.x} ${world.y}`;
  })();

  const removeEdge = (id: string) => {
    onChange(nodes, edges.filter((e) => e.id !== id));
  };

  return (
    <div
      ref={containerRef}
      className="node-editor"
      onPointerDown={onCanvasPointerDown}
      onWheel={onWheel}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      style={{
        cursor:
          interaction?.kind === 'pan'
            ? 'grabbing'
            : interaction?.kind === 'node'
            ? 'grabbing'
            : 'default',
      }}
    >
      <div
        className="node-editor-viewport"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <svg
          className="node-editor-edges"
          width="1"
          height="1"
          style={{ overflow: 'visible' }}
        >
          {edges.map((e) => {
            const d = edgePath(e.from, e.to);
            if (!d) return null;
            const isHover = hoveredEdgeId === e.id;
            return (
              <g key={e.id}>
                <path d={d} className="edge-path" />
                <path
                  d={d}
                  className="edge-hit"
                  onPointerEnter={() => setHoveredEdgeId(e.id)}
                  onPointerLeave={() => setHoveredEdgeId(null)}
                  onClick={() => removeEdge(e.id)}
                />
                {isHover && <path d={d} className="edge-path-hover" />}
              </g>
            );
          })}
          {previewPath && <path d={previewPath} className="edge-path-preview" />}
        </svg>

        {nodes.map((n) => (
          <NodeCard
            key={n.id}
            node={n}
            selected={selectedNodeId === n.id}
            active={activeSet.has(n.id)}
            onPointerDown={(e) => onNodePointerDown(e, n.id)}
            onPortPointerDown={onPortPointerDown}
          />
        ))}
      </div>

      <div className="node-editor-hint">
        drag · port-drag to connect · scroll to zoom · click edge to delete · Delete removes a node
      </div>

      <div className="node-editor-zoom">
        <button
          className="zoom-btn"
          onClick={() => setViewport((v) => ({ ...v, zoom: Math.min(2.5, v.zoom * 1.2) }))}
        >
          +
        </button>
        <button
          className="zoom-btn"
          onClick={() => setViewport((v) => ({ ...v, zoom: Math.max(0.3, v.zoom / 1.2) }))}
        >
          −
        </button>
        <span>{Math.round(viewport.zoom * 100)}%</span>
        <button
          className="zoom-btn"
          onClick={() => setViewport({ x: 40, y: 40, zoom: 1 })}
        >
          reset
        </button>
        {onRun && (
          <button
            className="zoom-btn primary"
            disabled={running}
            onClick={onRun}
          >
            {running ? 'Running…' : 'Run'}
          </button>
        )}
      </div>
    </div>
  );
}

interface NodeCardProps {
  node: NodeInstance;
  selected: boolean;
  active: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
  onPortPointerDown: (
    e: ReactPointerEvent,
    nodeId: string,
    portId: string,
    side: 'in' | 'out'
  ) => void;
}

function NodeCard({
  node,
  selected,
  active,
  onPointerDown,
  onPortPointerDown,
}: NodeCardProps) {
  const def = NODE_TYPES[node.type];
  if (!def) return null;
  const color = CATEGORY_COLORS[def.category];
  const height = getNodeHeight(node.type);

  return (
    <div
      className={`node-card ${selected ? 'selected' : ''} ${active ? 'active' : ''}`}
      style={{
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        height,
        borderTopColor: color,
      }}
      onPointerDown={onPointerDown}
    >
      <div className="node-card-header">
        <div className="node-card-category" style={{ color }}>
          {def.category}
        </div>
        <div className="node-card-label">{def.label}</div>
      </div>
      <div className="node-card-body">
        <div className="node-card-ports-in">
          {def.inputs.map((p) => (
            <div key={p.id} className="node-port-row-in">
              <div
                className="node-port"
                data-port-node={node.id}
                data-port-id={p.id}
                data-port-side="in"
                onPointerDown={(e) => onPortPointerDown(e, node.id, p.id, 'in')}
              />
              <span className="node-port-label">{p.label}</span>
            </div>
          ))}
        </div>
        <div className="node-card-ports-out">
          {def.outputs.map((p) => (
            <div key={p.id} className="node-port-row-out">
              <span className="node-port-label">{p.label}</span>
              <div
                className="node-port"
                data-port-node={node.id}
                data-port-id={p.id}
                data-port-side="out"
                onPointerDown={(e) => onPortPointerDown(e, node.id, p.id, 'out')}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
