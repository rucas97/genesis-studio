import { useEffect } from 'react';
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
  key: string;
  hint: string;
}> = [
  { id: 'select',  label: 'select',  icon: '☉', key: 'V', hint: 'pick a residue' },
  { id: 'cut',     label: 'cut',     icon: '✂', key: 'X', hint: 'split the chain at a residue' },
  { id: 'attach',  label: 'attach',  icon: '⌇', key: 'A', hint: 'merge two fragments' },
  { id: 'measure', label: 'measure', icon: '↔', key: 'M', hint: 'distance between two residues' },
  { id: 'bind',    label: 'bind',    icon: '⚯', key: 'B', hint: 'dock a ligand into a pocket' },
];

export function ToolBelt({ tool, onToolChange }: ToolBeltProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const t = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (t) { e.preventDefault(); onToolChange(t.id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onToolChange]);

  return (
    <div className="tool-strip">
      <div className="tool-strip-tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tool-strip-btn ${tool === t.id ? 'active' : ''}`}
            onClick={() => onToolChange(t.id)}
            title={`${t.label} (${t.key}) — ${t.hint}`}
          >
            <span className="tool-strip-icon">{t.icon}</span>
            <span className="tool-strip-label">{t.label}</span>
            <span className="tool-strip-key">{t.key}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
