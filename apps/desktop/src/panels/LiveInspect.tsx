export interface LiveInspectProps {
  tool: string;
  residueLabel: string | null;
  ligandName: string | null;
  lastKey: string | null;
}

export function LiveInspect({
  tool, residueLabel, ligandName, lastKey,
}: LiveInspectProps) {
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
