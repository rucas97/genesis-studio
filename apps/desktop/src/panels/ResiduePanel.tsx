import { useState } from 'react';
import type { PickedResidue } from '../state/usePlaySession';

const VALID_AA = 'ACDEFGHIKLMNPQRSTVWY';

export function ResiduePanel({
  residue, disabled, onMutate,
}: {
  residue: PickedResidue;
  disabled: boolean;
  onMutate: (aa: string) => void;
}) {
  const [newAA, setNewAA] = useState('');
  const valid = newAA.length === 1 && VALID_AA.includes(newAA);
  const sameAsRef = newAA === residue.residueOneLetter;

  return (
    <div className="panel">
      <div className="panel-label">Residue</div>
      <div className="panel-value">
        {residue.residueOneLetter}{residue.residueNumber}
      </div>
      <div className="panel-hint">Position {residue.residueNumber}</div>

      <div className="panel-label" style={{ marginTop: 16 }}>Mutate to</div>
      <input
        className="aa-input"
        maxLength={1}
        value={newAA}
        onChange={(e) => setNewAA(e.target.value.toUpperCase())}
        placeholder="R"
        disabled={disabled}
      />
      <button
        className="primary"
        disabled={!valid || sameAsRef || disabled}
        onClick={() => onMutate(newAA)}
      >
        {disabled ? 'Predicting…' : 'Apply mutation'}
      </button>
      {sameAsRef && newAA && (
        <div className="panel-hint">Already {residue.residueOneLetter}.</div>
      )}
    </div>
  );
}
