import type { PlaygroundTool } from '../scene/ProteinViewer';

export interface ToolBeltProps {
  tool: PlaygroundTool;
  onToolChange: (t: PlaygroundTool) => void;
  measureDistance?: number | null;
  onClearMeasure?: () => void;
  segmentCount?: number;
  onResetSegments?: () => void;
}

const TOOLS: Array<{
  id: PlaygroundTool;
  label: string;
  icon: string;
  hint: string;
}> = [
  { id: 'select',  label: 'Select',  icon: '☉', hint: 'Click a residue to pick it' },
  { id: 'cut',     label: 'Cut',     icon: '✂', hint: 'Click a residue to split the chain' },
  { id: 'attach',  label: 'Attach',  icon: '⌇', hint: 'Click two residues on different fragments' },
  { id: 'measure', label: 'Measure', icon: '↔', hint: 'Click two residues to see the distance' },
  { id: 'bind',    label: 'Bind',    icon: '⚯', hint: 'Click two residues to bind them' },
];

export function ToolBelt({
  tool,
  onToolChange,
  measureDistance,
  onClearMeasure,
  segmentCount,
  onResetSegments,
}: ToolBeltProps) {
  const activeHint = TOOLS.find((t) => t.id === tool)?.hint ?? '';

  return (
    <div className="tool-belt">
      <div className="tool-belt-tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tool-btn ${tool === t.id ? 'active' : ''}`}
            onClick={() => onToolChange(t.id)}
            title={t.hint}
          >
            <span className="tool-icon">{t.icon}</span>
            <span className="tool-label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="tool-belt-info">
        <span className="tool-hint">{activeHint}</span>
        {typeof measureDistance === 'number' && (
          <span className="tool-readout">
            {measureDistance.toFixed(2)} Å
            <button className="tool-clear" onClick={onClearMeasure}>×</button>
          </span>
        )}
        {typeof segmentCount === 'number' && segmentCount > 1 && (
          <span className="tool-readout">
            {segmentCount} fragments
            <button className="tool-clear" onClick={onResetSegments}>reset</button>
          </span>
        )}
      </div>
    </div>
  );
}
