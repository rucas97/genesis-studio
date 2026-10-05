import { NODE_TYPES, CATEGORY_COLORS } from './nodeTypes';
import type { NodeInstance } from './NodeEditor';

export interface NodeParamsPanelProps {
  node: NodeInstance | null;
  onChange: (nodeId: string, key: string, value: unknown) => void;
  onDelete: (nodeId: string) => void;
}

export function NodeParamsPanel({
  node,
  onChange,
  onDelete,
}: NodeParamsPanelProps) {
  if (!node) {
    return (
      <div className="panel params-panel">
        <div className="panel-label">Node parameters</div>
        <p className="panel-hint">
          Click a node in the canvas to view and edit its parameters.
        </p>
      </div>
    );
  }

  const def = NODE_TYPES[node.type];
  if (!def) return null;
  const color = CATEGORY_COLORS[def.category];

  return (
    <div className="panel params-panel">
      <div className="params-header">
        <span className="params-category" style={{ color }}>
          {def.category}
        </span>
        <button className="params-delete" onClick={() => onDelete(node.id)}>
          Delete
        </button>
      </div>
      <div className="params-title">{def.label}</div>
      <p className="panel-hint">{def.description}</p>

      <div className="params-section">
        <div className="panel-label">Inputs</div>
        {def.inputs.length === 0 ? (
          <div className="params-empty">none</div>
        ) : (
          def.inputs.map((p) => (
            <div key={p.id} className="params-port-row">
              <span className="params-port-dot in" />
              <span className="params-port-label">{p.label}</span>
              <span className="params-port-kind">{p.kind}</span>
            </div>
          ))
        )}
      </div>

      <div className="params-section">
        <div className="panel-label">Outputs</div>
        {def.outputs.length === 0 ? (
          <div className="params-empty">none</div>
        ) : (
          def.outputs.map((p) => (
            <div key={p.id} className="params-port-row">
              <span className="params-port-dot out" />
              <span className="params-port-label">{p.label}</span>
              <span className="params-port-kind">{p.kind}</span>
            </div>
          ))
        )}
      </div>

      {def.params && def.params.length > 0 && (
        <div className="params-section">
          <div className="panel-label">Parameters</div>
          {def.params.map((p) => {
            const value = node.params[p.key] ?? p.default;
            return (
              <div key={p.key} className="params-field">
                <label className="params-field-label">{p.label}</label>
                {p.type === 'text' && (
                  <input
                    className="params-input"
                    value={String(value ?? '')}
                    onChange={(e) => onChange(node.id, p.key, e.target.value)}
                  />
                )}
                {p.type === 'number' && (
                  <input
                    className="params-input"
                    type="number"
                    value={Number(value ?? 0)}
                    onChange={(e) =>
                      onChange(node.id, p.key, Number(e.target.value))
                    }
                  />
                )}
                {p.type === 'select' && (
                  <select
                    className="params-input"
                    value={String(value ?? '')}
                    onChange={(e) => onChange(node.id, p.key, e.target.value)}
                  >
                    {(p.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="params-section">
        <div className="panel-label">Node ID</div>
        <div className="params-id">{node.id}</div>
      </div>
    </div>
  );
}
