import { useEffect, useRef, useState } from 'react';
import type { Action, EventLog } from '@genesis/shared';

export interface SessionLogPanelProps {
  log: EventLog;
  actionCount: number;
}

const MODE_COLOR: Record<string, string> = {
  play: '#66ccff',
  flow: '#88ff88',
  emergence: '#cc88ff',
  system: '#8899aa',
};

export function SessionLogPanel({ log, actionCount }: SessionLogPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState(true);

  const actions = log.all;

  useEffect(() => {
    if (pinned && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [actionCount, pinned]);

  return (
    <div className="panel session-log">
      <div className="panel-label">
        Session log
        <span className="log-count">{actions.length}</span>
      </div>

      <div
        ref={scrollRef}
        className="log-scroll"
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          setPinned(atBottom);
        }}
      >
        {actions.length === 0 && (
          <div className="log-empty">No actions yet.</div>
        )}
        {actions.map((a, i) => (
          <LogRow key={a.id} action={a} index={i} />
        ))}
      </div>
    </div>
  );
}

function LogRow({ action, index }: { action: Action; index: number }) {
  const mode = action.mode;
  const color = MODE_COLOR[mode] ?? '#8899aa';
  const time = formatTime(action.timestamp);
  const shortType = action.type;
  const summary = summarize(action);

  return (
    <div className="log-row">
      <span className="log-index">{index + 1}</span>
      <span className="log-mode" style={{ color }}>
        {mode}
      </span>
      <span className="log-type">{shortType}</span>
      <span className="log-summary">{summary}</span>
      <span className="log-time">{time}</span>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toTimeString().slice(0, 8);
  } catch {
    return '';
  }
}

function summarize(a: Action): string {
  const p = a.payload as Record<string, unknown>;
  switch (a.type) {
    case 'play.mutate': {
      const v = p.variant as { hgvs?: string } | undefined;
      return v?.hgvs ?? '';
    }
    case 'play.create':
      return 'create';
    case 'ai.hypothesis.generate':
      return 'hypothesis';
    case 'flow.run.start':
      return String(p.label ?? 'run start');
    case 'flow.run.complete':
      return `${p.rows ?? '?'} rows`;
    case 'bridge.play_to_flow':
    case 'bridge.flow_to_play':
      return 'bridged';
    default:
      return '';
  }
}
