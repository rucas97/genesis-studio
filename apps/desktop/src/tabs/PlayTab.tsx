import { ProteinViewer } from '../scene/ProteinViewer';

const DEMO_PDB = '4HJO'; // EGFR kinase domain

export function PlayTab() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ProteinViewer pdbId={DEMO_PDB} />
      <div className="scene-overlay">
        <strong>Play</strong> · {DEMO_PDB} · EGFR kinase domain · read-only preview
      </div>
    </div>
  );
}
