import { useMemo } from 'react';
import type { CAAtom } from '../scene/pdbLoader';

export interface SequenceViewerProps {
  atoms: CAAtom[];
  pickedIndex: number | null;
  mutatedResidueNumber: number | null;
  onResidueClick?: (index: number) => void;
}

const WINDOW = 12;

export function SequenceViewer({
  atoms, pickedIndex, mutatedResidueNumber, onResidueClick,
}: SequenceViewerProps) {
  const data = useMemo(() => {
    if (atoms.length === 0 || pickedIndex === null) {
      return { letters: [] as string[], indices: [] as number[] };
    }
    const s = Math.max(0, pickedIndex - WINDOW);
    const e = Math.min(atoms.length, pickedIndex + WINDOW + 1);
    const ls: string[] = [];
    const is: number[] = [];
    for (let i = s; i < e; i++) {
      ls.push(atoms[i].residueOneLetter);
      is.push(i);
    }
    return { letters: ls, indices: is };
  }, [atoms, pickedIndex]);

  if (pickedIndex === null) {
    return (
      <div className="seq-viewer">
        <div className="seq-empty">Pick a residue to see the local sequence.</div>
      </div>
    );
  }

  const pickedLetter = atoms[pickedIndex]?.residueOneLetter ?? '?';
  const pickedNum = atoms[pickedIndex]?.residueNumber ?? 0;

  return (
    <div className="seq-viewer">
      <div className="seq-line">
        {data.letters.map((letter, i) => {
          const atom = atoms[data.indices[i]];
          const isPicked = data.indices[i] === pickedIndex;
          const isMut = atom.residueNumber === mutatedResidueNumber;
          const cls = isPicked ? 'picked' : isMut ? 'mutated' : '';
          return (
            <span
              key={i}
              className={`seq-letter ${cls}`}
              onClick={() => onResidueClick?.(data.indices[i])}
              title={`${letter}${atom.residueNumber}`}
            >
              {letter}
            </span>
          );
        })}
      </div>
      <div className="seq-numbers">
        {data.indices.map((idx, i) => {
          const atom = atoms[idx];
          const show = atom.residueNumber % 10 === 0 || idx === pickedIndex;
          return (
            <span key={i} className="seq-num">
              {show ? atom.residueNumber : ''}
            </span>
          );
        })}
      </div>
      <div className="seq-meta">
        {pickedLetter}{pickedNum}
        <span className="seq-meta-secondary"> position {pickedNum}</span>
      </div>
    </div>
  );
}
