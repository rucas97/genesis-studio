import type { Variant } from '@genesis/shared';

export interface InspectStripProps {
  tool: string;
  residueLabel: string | null;
  variant: Variant | null;
  deltaDeltaG: number | null;
  method: string | null;
  ligandCount: number;
  fragmentCount: number | null;
}

export function InspectStrip({
  tool, residueLabel, variant, deltaDeltaG, method, ligandCount, fragmentCount,
}: InspectStripProps) {
  const items: Array<{ label: string; value: string; accent?: string }> = [];

  items.push({ label: 'tool', value: tool, accent: '#66ccff' });

  if (residueLabel) items.push({ label: 'residue', value: residueLabel });
  if (variant) items.push({ label: 'mutation', value: variant.hgvs });
  if (deltaDeltaG !== null && method) {
    const isBad = deltaDeltaG < -1;
    items.push({
      label: 'ΔΔG',
      value: `${deltaDeltaG.toFixed(2)} (${method})`,
      accent: isBad ? '#ff8888' : '#88ff88',
    });
  }
  if (ligandCount > 0) {
    items.push({ label: 'ligands', value: String(ligandCount) });
  }
  if (fragmentCount && fragmentCount > 1) {
    items.push({ label: 'fragments', value: String(fragmentCount), accent: '#ffaa44' });
  }

  return (
    <div className="inspect-strip">
      {items.map((it, i) => (
        <div key={i} className="inspect-strip-item">
          <span className="inspect-strip-label">{it.label}</span>
          <span
            className="inspect-strip-value"
            style={it.accent ? { color: it.accent } : undefined}
          >
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}
