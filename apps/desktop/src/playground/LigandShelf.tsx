import { LIGAND_LIBRARY, type LigandEntry } from '../data/ligandLibrary';

export interface LigandShelfProps {
  activeId: string | null;
  onPick: (entry: LigandEntry | null) => void;
}

export function LigandShelf({ activeId, onPick }: LigandShelfProps) {
  return (
    <div className="panel ligand-shelf">
      <div className="panel-label">Ligand shelf</div>
      <div className="ligand-list">
        {LIGAND_LIBRARY.map((l) => (
          <button
            key={l.id}
            className={`ligand-item ${activeId === l.id ? 'active' : ''}`}
            onClick={() => onPick(activeId === l.id ? null : l)}
            title={l.notes}
          >
            <div className="ligand-item-top">
              <span className="ligand-name">{l.name}</span>
              <span className="ligand-formula">{l.formula}</span>
            </div>
            <div className="ligand-target">{l.target}</div>
            {l.approximate && (
              <div className="ligand-approx">simplified shape</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
