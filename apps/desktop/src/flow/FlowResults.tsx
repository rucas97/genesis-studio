import type { PipelineRow } from './runPipeline';

export interface FlowResultsProps {
  rows: PipelineRow[];
}

export function FlowResults({ rows }: FlowResultsProps) {
  if (rows.length === 0) {
    return (
      <div className="flow-results-empty">
        Run the pipeline to see ranked variants.
      </div>
    );
  }

  return (
    <table className="flow-results">
      <thead>
        <tr>
          <th className="rank">#</th>
          <th>Variant</th>
          <th>ΔΔG</th>
          <th>95% CI</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const ddg = r.prediction.deltaDeltaG;
          const cls = ddg < -2 ? 'bad' : ddg < -1 ? 'warn' : 'ok';
          return (
            <tr key={r.variant.id}>
              <td className="rank">{i + 1}</td>
              <td className="mono">{r.variant.hgvs}</td>
              <td className={`mono ddg-cell ${cls}`}>{ddg.toFixed(2)}</td>
              <td className="mono ci">
                [{r.prediction.deltaDeltaGCI[0].toFixed(2)},{' '}
                {r.prediction.deltaDeltaGCI[1].toFixed(2)}]
              </td>
              <td className="note">{r.note}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
