export interface LiveInspectFeedback {
  kind: 'ok' | 'err' | 'info';
  message: string;
}

export interface LiveInspectProps {
  tool: string;
  residueLabel: string | null;
  ligandName: string | null;
  lastKey: string | null;
  hint?: string | null;
  measureDistance?: number | null;
  fragmentCount?: number | null;
  feedback?: LiveInspectFeedback | null;
  onClearMeasure?: () => void;
  onResetSegments?: () => void;
}

export function LiveInspect({
  tool, residueLabel, ligandName, lastKey,
  hint, measureDistance, fragmentCount, feedback,
  onClearMeasure, onResetSegments,
}: LiveInspectProps) {
  const hasFooter =
    !!hint ||
    measureDistance !== undefined && measureDistance !== null ||
    fragmentCount !== undefined && fragmentCount !== null && fragmentCount > 1 ||
    !!feedback;

  return (
    <div className="live-inspect">
      <div className="live-inspect-header">
        <span className="live-inspect-title">inspect</span>
        <span className={`live-inspect-key ${lastKey ? 'active' : ''}`}>
          {lastKey ?? ''}
        </span>
      </div>

      <div className="live-inspect-rows">
        <Row label="tool" value={tool} accent />
        <Row label="residue" value={residueLabel ?? '—'} />
        <Row label="ligand" value={ligandName ?? '—'} />
      </div>

      {hasFooter && (
        <div className="live-inspect-footer">
          {hint && (
            <div className="live-inspect-hint">{hint}</div>
          )}
          {typeof measureDistance === 'number' && (
            <div className="live-inspect-readout">
              <span className="live-inspect-readout-label">distance</span>
              <span className="live-inspect-readout-value">
                {measureDistance.toFixed(2)} Å
              </span>
              {onClearMeasure && (
                <button className="live-inspect-readout-clear" onClick={onClearMeasure}>
                  ×
                </button>
              )}
            </div>
          )}
          {typeof fragmentCount === 'number' && fragmentCount > 1 && (
            <div className="live-inspect-readout">
              <span className="live-inspect-readout-label">fragments</span>
              <span className="live-inspect-readout-value">{fragmentCount}</span>
              {onResetSegments && (
                <button className="live-inspect-readout-clear" onClick={onResetSegments}>
                  ↺
                </button>
              )}
            </div>
          )}
          {feedback && (
            <div className={`live-inspect-feedback ${feedback.kind}`}>
              {feedback.kind === 'ok' ? '✓ ' : feedback.kind === 'err' ? '✕ ' : 'ℹ '}
              {feedback.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label, value, accent,
}: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="live-inspect-row">
      <span className="live-inspect-label">{label}</span>
      <span className={`live-inspect-value ${accent ? 'accent' : ''}`}>
        {value}
      </span>
    </div>
  );
}
