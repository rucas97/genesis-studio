import { useEffect, useMemo, useRef, useState } from 'react';
import type { Action, EventLog } from '@genesis/shared';
import { MiniPlayView } from './MiniPlayView';
import { buildSnapshotAtIndex } from './snapshotFolder';

export interface SessionLogPanelProps {
  log: EventLog;
  actionCount: number;
  defaultPdbId: string;
  defaultProteinId: string;
}

const MODE_COLOR: Record<string, string> = {
  play: '#66ccff',
  flow: '#88ff88',
  emergence: '#cc88ff',
  system: '#8899aa',
};

export function SessionLogPanel({
  log, actionCount, defaultPdbId, defaultProteinId,
}: SessionLogPanelProps) {
  const actions = log.all;
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [pinned, setPinned] = useState(true);

  useEffect(() => {
    if (replayIndex !== null) return;
    if (pinned && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [actionCount, pinned, replayIndex]);

  useEffect(() => {
    if (replayIndex === null) return;
    const row = rowRefs.current[replayIndex];
    if (row && scrollRef.current) {
      const container = scrollRef.current;
      const top = row.offsetTop - container.clientHeight / 2 + row.clientHeight / 2;
      container.scrollTop = Math.max(0, top);
    }
  }, [replayIndex]);

  useEffect(() => {
    if (!playing) return;
    if (actions.length === 0) { setPlaying(false); return; }
    if (replayIndex === null) { setReplayIndex(0); return; }
    if (replayIndex >= actions.length - 1) { setPlaying(false); return; }
    const t = window.setTimeout(() => {
      setReplayIndex((i) => (i === null ? 0 : Math.min(i + 1, actions.length - 1)));
    }, 700);
    return () => window.clearTimeout(t);
  }, [playing, replayIndex, actions.length]);

  const snapshot = useMemo(() => {
    if (replayIndex === null) return null;
    return buildSnapshotAtIndex(actions, replayIndex, defaultPdbId, defaultProteinId);
  }, [replayIndex, actions, defaultPdbId, defaultProteinId]);

  const startReplay = () => {
    setPlaying(false);
    setReplayIndex(actions.length === 0 ? null : 0);
  };
  const stopReplay = () => { setPlaying(false); setReplayIndex(null); };
  const togglePlay = () => {
    if (replayIndex === null) setReplayIndex(0);
    setPlaying((p) => !p);
  };

  return (
    <div className="panel session-log">
      <div className="panel-label">
        Session log
        <span className="log-count">{actions.length}</span>
      </div>

      {actions.length > 0 && (
        <div className="replay-controls">
          <button className="zoom-btn" onClick={startReplay} title="Start replay">⏮</button>
          <button className="zoom-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
            {playing ? '⏸' : '▶'}
          </button>
          <button className="zoom-btn" onClick={stopReplay} title="Exit replay">✕</button>
          <input
            type="range"
            className="replay-slider"
            min={0}
            max={Math.max(0, actions.length - 1)}
            value={replayIndex ?? Math.max(0, actions.length - 1)}
            onChange={(e) => { setPlaying(false); setReplayIndex(Number(e.target.value)); }}
          />
          <span className="replay-position">
            {replayIndex === null ? `−/${actions.length}` : `${replayIndex + 1}/${actions.length}`}
          </span>
        </div>
      )}

      {snapshot && (
        <div className="replay-snapshot">
          <MiniPlayView snapshot={snapshot} />
        </div>
      )}

      <div
        ref={scrollRef}
        className="log-scroll"
        onScroll={(e) => {
          if (replayIndex !== null) return;
          const el = e.currentTarget;
          setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
        }}
      >
        {actions.length === 0 && <div className="log-empty">No actions yet.</div>}
        {actions.map((a, i) => (
          <LogRow
            key={a.id}
            action={a}
            index={i}
            active={replayIndex === i}
            setRef={(el) => { rowRefs.current[i] = el; }}
          />
        ))}
      </div>
    </div>
  );
}

function LogRow({
  action, index, active, setRef,
}: {
  action: Action;
  index: number;
  active: boolean;
  setRef: (el: HTMLDivElement | null) => void;
}) {
  const color = MODE_COLOR[action.mode] ?? '#8899aa';
  return (
    <div ref={setRef} className={`log-row ${active ? 'active' : ''}`}>
      <span className="log-index">{index + 1}</span>
      <span className="log-mode" style={{ color }}>{action.mode}</span>
      <span className="log-type">{action.type}</span>
      <span className="log-summary">{summarize(action)}</span>
      <span className="log-time">{formatTime(action.timestamp)}</span>
    </div>
  );
}

function formatTime(iso: string): string {
  try { return new Date(iso).toTimeString().slice(0, 8); } catch { return ''; }
}

function summarize(a: Action): string {
  const p = a.payload as Record<string, unknown>;
  switch (a.type) {
    case 'play.mutate': {
      const v = p.variant as { hgvs?: string } | undefined;
      return v?.hgvs ?? '';
    }
    case 'play.add_ligand': return String(p.ligandId ?? '');
    case 'play.move_ligand': return 'moved';
    case 'play.set_protein': return String(p.proteinId ?? '');
    case 'play.pick_residue': return `#${p.residueNumber ?? ''}`;
    case 'ai.hypothesis.generate': return 'hypothesis';
    case 'flow.run.start': return String(p.label ?? 'run start');
    case 'flow.run.complete': return `${p.rows ?? '?'} rows`;
    default: return '';
  }
}
