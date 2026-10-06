import { useState, type ReactNode } from 'react';

export type InspectorTab = 'input' | 'inspect' | 'ai';

export interface InspectorProps {
  topStrip?: ReactNode;
  input: ReactNode;
  inspect: ReactNode;
  ai: ReactNode;
  initialTab?: InspectorTab;
}

export function Inspector({
  topStrip, input, inspect, ai, initialTab = 'input',
}: InspectorProps) {
  const [tab, setTab] = useState<InspectorTab>(initialTab);
  return (
    <div className="inspector">
      {topStrip && <div className="inspector-strip-wrap">{topStrip}</div>}
      <div className="inspector-tabs">
        <TabButton active={tab === 'input'} onClick={() => setTab('input')}>Input</TabButton>
        <TabButton active={tab === 'inspect'} onClick={() => setTab('inspect')}>Inspect</TabButton>
        <TabButton active={tab === 'ai'} onClick={() => setTab('ai')}>AI</TabButton>
      </div>
      <div className="inspector-body">
        {tab === 'input' && input}
        {tab === 'inspect' && inspect}
        {tab === 'ai' && ai}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button className={`inspector-tab ${active ? 'active' : ''}`} onClick={onClick}>{children}</button>;
}

export interface SectionProps {
  title: string;
  count?: number | string;
  defaultOpen?: boolean;
  children: ReactNode;
  accent?: string;
}

export function Section({ title, count, defaultOpen = true, children, accent }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <button className="section-header" onClick={() => setOpen((o) => !o)}>
        <span className="section-caret">{open ? '\u25BE' : '\u25B8'}</span>
        <span className="section-title" style={accent ? { color: accent } : undefined}>{title}</span>
        {count !== undefined && <span className="section-count">{count}</span>}
      </button>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}
