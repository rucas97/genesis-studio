export function SecondaryStructureLegend() {
  return (
    <div className="ss-legend">
      <div className="ss-legend-item">
        <span className="ss-dot helix" />
        <span className="ss-label">helix</span>
      </div>
      <div className="ss-legend-item">
        <span className="ss-dot sheet" />
        <span className="ss-label">sheet</span>
      </div>
      <div className="ss-legend-item">
        <span className="ss-dot coil" />
        <span className="ss-label">coil</span>
      </div>
    </div>
  );
}
