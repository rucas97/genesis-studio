import type { Hypothesis } from '@genesis/shared';
import type { Observation } from '@genesis/ai';

export function AICard({
  observation, hypothesis,
}: {
  observation: Observation | null;
  hypothesis: Hypothesis | null;
}) {
  if (!observation) return null;

  return (
    <div className="ai-card">
      <div className="ai-label">AI co-scientist</div>
      <p className="ai-summary">{observation.summary}</p>

      <div className="ai-metrics">
        <div>
          <span className="ai-metric-label">Confidence</span>
          <span className="ai-metric-value">{observation.confidence.toFixed(2)}</span>
        </div>
        <div>
          <span className="ai-metric-label">Agreement</span>
          <span className="ai-metric-value">{observation.agreement.toFixed(2)}</span>
        </div>
      </div>

      {observation.flags.length > 0 && (
        <div className="ai-flags">
          {observation.flags.map((f) => (
            <span key={f} className="ai-flag">{f}</span>
          ))}
        </div>
      )}

      {hypothesis && (
        <>
          <div className="ai-section">
            <div className="ai-section-label">Claim</div>
            <p>{hypothesis.claim}</p>
          </div>
          <div className="ai-section">
            <div className="ai-section-label">Falsification</div>
            <p>{hypothesis.falsification}</p>
          </div>
        </>
      )}

      <div className="stub-note">Stub co-scientist. Not for scientific use.</div>
    </div>
  );
}
