import type { Variant } from '@genesis/shared';
import type { StabilityPrediction } from '@genesis/engines';

export function MutationPanel({
  variant, prediction,
}: {
  variant: Variant;
  prediction: StabilityPrediction | null;
}) {
  return (
    <div className="panel">
      <div className="panel-label">Mutation</div>
      <div className="panel-value mono">{variant.hgvs}</div>

      {prediction ? (
        <>
          <div className="panel-label" style={{ marginTop: 16 }}>Predicted ΔΔG</div>
          <div className={`ddg ${prediction.deltaDeltaG < -1 ? 'bad' : 'ok'}`}>
            {prediction.deltaDeltaG.toFixed(2)}
            <span className="ddg-unit">kcal/mol</span>
          </div>
          <div className="panel-hint">
            95% CI [{prediction.deltaDeltaGCI[0].toFixed(2)},{' '}
            {prediction.deltaDeltaGCI[1].toFixed(2)}]
          </div>
          <div className="panel-hint">
            {prediction.method} v{prediction.methodVersion}
          </div>
        </>
      ) : (
        <div className="panel-hint" style={{ marginTop: 12 }}>Predicting…</div>
      )}
    </div>
  );
}
