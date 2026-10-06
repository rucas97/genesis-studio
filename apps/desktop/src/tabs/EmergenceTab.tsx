import { useEffect, useRef, useState } from 'react';
import { CellScene, type EmergencePhase } from '../emergence/CellScene';

const PHASES: Array<{
  phase: EmergencePhase;
  label: string;
  description: string;
  durationMs: number;
}> = [
  { phase: 'year0',    label: 'Year 0',  description: 'Baseline cell. Normal proliferation.', durationMs: 3000 },
  { phase: 'year5',    label: 'Year 5',  description: 'Increased proliferative signaling detected.', durationMs: 3000 },
  { phase: 'year10',   label: 'Year 10', description: 'Tumor mass forming. Neighboring cells recruited.', durationMs: 3500 },
  { phase: 'critical', label: 'Year 14', description: 'Critical transition detected. Immune escape.', durationMs: 3500 },
];

export function EmergenceTab() {
  const [phase, setPhase] = useState<EmergencePhase>('idle');
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<Array<{ year: string; text: string }>>([]);
  const timersRef = useRef<number[]>([]);

  const stop = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    setRunning(false);
  };

  useEffect(() => () => stop(), []);

  const handleRun = () => {
    stop();
    setLog([]);
    setRunning(true);
    setPhase('year0');
    setLog([{ year: 'Year 0', text: 'Simulation started. Baseline tissue state.' }]);

    let elapsed = 0;
    for (const p of PHASES) {
      elapsed += p.durationMs;
      const t = window.setTimeout(() => {
        setPhase(p.phase);
        setLog((l) => [...l, { year: p.label, text: p.description }]);
      }, elapsed);
      timersRef.current.push(t);
    }

    const endTimer = window.setTimeout(() => setRunning(false), elapsed + 200);
    timersRef.current.push(endTimer);
  };

  const handleReset = () => {
    stop();
    setPhase('idle');
    setLog([]);
  };

  const phaseLabel =
    phase === 'idle' ? 'idle'
    : PHASES.find((p) => p.phase === phase)?.label ?? phase;

  return (
    <div className="emergence-layout">
      <div className="emergence-scene">
        <CellScene phase={phase} />
        <div className="emergence-badge">
          Emergence · Phase 3 · placeholder
        </div>
        <div className="emergence-overlay">
          <strong>Emergence</strong> · {phaseLabel}
        </div>
      </div>

      <aside className="emergence-sidebar">
        <div className="panel">
          <div className="panel-label">Emergence Engine</div>
          <p className="panel-hint">
            This mode is under construction. The scene shows a stylized
            cell with a scripted timeline. No real simulation runs.
          </p>
          <p className="panel-hint">
            The real engine will perform multi-scale, long-timescale
            simulation of disease emergence — see <code>docs/vision</code>.
          </p>
        </div>

        <div className="panel">
          <div className="panel-label">Configuration</div>
          <div className="emergence-field">
            <span className="emergence-field-label">Genome</span>
            <span className="emergence-field-value">synthetic · EGFR L858R</span>
          </div>
          <div className="emergence-field">
            <span className="emergence-field-label">Tissue</span>
            <span className="emergence-field-value">lung epithelium</span>
          </div>
          <div className="emergence-field">
            <span className="emergence-field-label">Timescale</span>
            <span className="emergence-field-value">10 years biological</span>
          </div>
        </div>

        <div className="panel">
          <div className="emergence-controls">
            <button className="primary" disabled={running} onClick={handleRun}>
              {running ? 'Simulating…' : '▶  Run simulation'}
            </button>
            <button
              className="zoom-btn"
              disabled={running && log.length === 0}
              onClick={handleReset}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-label">Timeline</div>
          <div className="emergence-timeline">
            {log.length === 0 && (
              <div className="emergence-timeline-empty">
                Run the simulation to see events.
              </div>
            )}
            {log.map((e, i) => (
              <div key={i} className="emergence-event">
                <span className="emergence-event-year">{e.year}</span>
                <span className="emergence-event-text">{e.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="stub-note" style={{ padding: '0 4px' }}>
          Research-use-only. Not a medical device.
        </div>
      </aside>
    </div>
  );
}
