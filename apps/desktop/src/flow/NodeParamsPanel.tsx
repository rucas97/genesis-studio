import { useRef } from 'react';
import { NODE_TYPES, CATEGORY_COLORS } from './nodeTypes';
import type { NodeInstance } from './NodeEditor';

export interface NodeParamsPanelProps {
  node: NodeInstance | null;
  onChange: (nodeId: string, key: string, value: unknown) => void;
  onDelete: (nodeId: string) => void;
}

export function NodeParamsPanel({ node, onChange, onDelete }: NodeParamsPanelProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  if (!node) {
    return (
      <div className="panel params-panel">
        <div className="panel-label">Node parameters</div>
        <p className="panel-hint">Click a node in the canvas to view and edit its parameters.</p>
      </div>
    );
  }

  const def = NODE_TYPES[node.type];
  if (!def) return null;
  const color = CATEGORY_COLORS[def.category];

  return (
    <div className="panel params-panel">
      <div className="params-header">
        <span className="params-category" style={{ color }}>{def.category}</span>
        <button className="params-delete" onClick={() => onDelete(node.id)}>Delete</button>
      </div>
      <div className="params-title">{def.label}</div>
      <p className="panel-hint">{def.description}</p>

      {def.inputs.length > 0 && (
        <div className="params-section">
          <div className="panel-label">Inputs</div>
          {def.inputs.map((p) => (
            <div key={p.id} className="params-port-row">
              <span className="params-port-dot in" />
              <span className="params-port-label">{p.label}</span>
              <span className="params-port-kind">{p.kind}</span>
            </div>
          ))}
        </div>
      )}

      {def.outputs.length > 0 && (
        <div className="params-section">
          <div className="panel-label">Outputs</div>
          {def.outputs.map((p) => (
            <div key={p.id} className="params-port-row">
              <span className="params-port-dot out" />
              <span className="params-port-label">{p.label}</span>
              <span className="params-port-kind">{p.kind}</span>
            </div>
          ))}
        </div>
      )}

      {def.params && def.params.length > 0 && (
        <div className="params-section">
          <div className="panel-label">Parameters</div>
          {def.params.map((p) => {
            const value = node.params[p.key] ?? p.default;

            if (p.type === 'textarea') {
              return (
                <div key={p.key} className="params-field">
                  <label className="params-field-label">{p.label}</label>
                  <textarea
                    className="params-input params-textarea"
                    value={String(value ?? '')}
                    onChange={(e) => onChange(node.id, p.key, e.target.value)}
                    rows={5}
                  />
                  {p.help && <div className="params-help">{p.help}</div>}
                </div>
              );
            }

            if (p.type === 'file') {
              return (
                <div key={p.key} className="params-field">
                  <label className="params-field-label">{p.label}</label>
                  <input
                    ref={fileRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const text = await f.text();
                      onChange(node.id, p.key, text);
                      e.target.value = '';
                    }}
                  />
                  <button className="zoom-btn" onClick={() => fileRef.current?.click()}>
                    Choose file…
                  </button>
                  <div className="params-help">
                    {value ? `Loaded (${String(value).length} chars)` : 'No file loaded.'}
                  </div>
                  {p.help && <div className="params-help">{p.help}</div>}
                </div>
              );
            }

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
                    className="params-input" type="number"
                    value={Number(value ?? 0)}
                    onChange={(e) => onChange(node.id, p.key, Number(e.target.value))}
                  />
                )}
                {p.type === 'select' && (
                  <select
                    className="params-input"
                    value={String(value ?? '')}
                    onChange={(e) => onChange(node.id, p.key, e.target.value)}
                  >
                    {(p.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
                {p.help && <div className="params-help">{p.help}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
