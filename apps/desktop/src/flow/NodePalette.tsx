import { NODE_TYPES, CATEGORY_COLORS, type NodeCategory } from './nodeTypes';

export interface NodePaletteProps {
  onAdd: (typeKey: string) => void;
}

const ORDER: NodeCategory[] = ['sequence', 'structure', 'genomics', 'utility', 'ai'];
const LABELS: Record<NodeCategory, string> = {
  sequence: 'Sequence',
  structure: 'Structure',
  genomics: 'Genomics',
  utility: 'Utility',
  ai: 'AI',
};

export function NodePalette({ onAdd }: NodePaletteProps) {
  const grouped = new Map<NodeCategory, string[]>();
  for (const key of Object.keys(NODE_TYPES)) {
    const def = NODE_TYPES[key];
    const arr = grouped.get(def.category) ?? [];
    arr.push(key);
    grouped.set(def.category, arr);
  }

  return (
    <div className="node-palette">
      <div className="node-palette-title">Nodes</div>
      {ORDER.map((cat) => {
        const items = grouped.get(cat);
        if (!items || items.length === 0) return null;
        return (
          <div key={cat} className="node-palette-group">
            <div
              className="node-palette-group-label"
              style={{ color: CATEGORY_COLORS[cat] }}
            >
              {LABELS[cat]}
            </div>
            {items.map((key) => {
              const def = NODE_TYPES[key];
              return (
                <div
                  key={key}
                  className="node-palette-item"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-genesis-node', key);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onDoubleClick={() => onAdd(key)}
                  title={def.description}
                >
                  <span
                    className="palette-dot"
                    style={{ background: CATEGORY_COLORS[cat] }}
                  />
                  {def.label}
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="node-palette-hint">
        Drag into the canvas, or double-click to add at center.
      </div>
    </div>
  );
}
