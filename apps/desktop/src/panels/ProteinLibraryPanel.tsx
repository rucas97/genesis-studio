import { PROTEIN_LIBRARY, type ProteinEntry } from '../data/proteinLibrary';

export interface ProteinLibraryPanelProps {
  currentId: string;
  onPick: (entry: ProteinEntry) => void;
}

export function ProteinLibraryPanel({
  currentId,
  onPick,
}: ProteinLibraryPanelProps) {
  return (
    <div className="panel protein-library">
      <div className="panel-label">Protein library</div>
      <div className="protein-list">
        {PROTEIN_LIBRARY.map((p) => {
          const active = p.id === currentId;
          return (
            <button
              key={p.id}
              className={`protein-item ${active ? 'active' : ''}`}
              onClick={() => onPick(p)}
            >
              <div className="protein-item-top">
                <span className="protein-gene">{p.gene}</span>
                <span className="protein-pdb">{p.pdbId}</span>
              </div>
              <div className="protein-name">{p.name}</div>
              <div className="protein-disease">{p.disease}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
