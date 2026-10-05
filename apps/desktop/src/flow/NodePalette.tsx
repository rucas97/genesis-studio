import { useState } from 'react';
import {
  NODE_TYPES,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type NodeCategory,
} from './nodeTypes';

export interface NodePaletteProps {
  onAdd: (typeKey: string) => void;
}

const ORDER: NodeCategory[] = [
  'input', 'sequence', 'structure', 'genomics', 'utility', 'ai',
];

export function NodePalette({ onAdd }: NodePaletteProps) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<NodeCategory, boolean>>({
    input: false, sequence: false, structure: false,
    genomics: false, utility: false, ai: false,
  });

  const q = query.trim().toLowerCase();

  const grouped = new Map<NodeCategory, string[]>();
  for (const key of Object.keys(NODE_TYPES)) {
    const def = NODE_TYPES[key];
    if (q) {
      const hay = `${def.label} ${def.description} ${def.key}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    const arr = grouped.get(def.category) ?? [];
    arr.push(key);
    grouped.set(def.category, arr);
  }

  return (
    <div className="node-palette">
      <div className="node-palette-header">
        <div className="node-palette-title">Nodes</div>
        <input
          className="node-palette-search"
          placeholder="Search nodes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {ORDER.map((cat) => {
        const items = grouped.get(cat);
        if (!items || items.length === 0) return null;
        const isCollapsed = collapsed[cat];
        return (
          <div key={cat} className="node-palette-group">
            <button
              className="node-palette-group-label"
              onClick={() => setCollapsed((c) => ({ ...c, [cat]: !c[cat] }))}
              style={{ color: CATEGORY_COLORS[cat] }}
            >
              <span className="palette-caret">{isCollapsed ? '▸' : '▾'}</span>
              {CATEGORY_LABELS[cat]}
              <span className="palette-count">{items.length}</span>
            </button>
            {!isCollapsed && (
              <div className="palette-grid">
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
                      <span className="palette-item-label">{def.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {Array.from(grouped.values()).every((a) => a.length === 0) && (
        <div className="node-palette-empty">No nodes match.</div>
      )}

      <div className="node-palette-hint">
        Drag into the canvas, or double-click to add at center.
      </div>
    </div>
  );
}
