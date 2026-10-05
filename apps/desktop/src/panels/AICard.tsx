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
          {hypothesis.mechanism && (
            <div className="ai-section">
              <div className="ai-section-label">Mechanism</div>
              <p>{hypothesis.mechanism}</p>
            </div>
          )}
          {hypothesis.predictions.length > 0 && (
            <div className="ai-section">
              <div className="ai-section-label">Predictions</div>
              <ul className="ai-predictions">
                {hypothesis.predictions.map((p, i) => (
                  <li key={i}>
                    <span className="ai-pred-type">{p.type}</span>
                    <span className="ai-pred-test">{p.test}</span>
                    <span className="ai-pred-exp">{p.expected}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="ai-section">
            <div className="ai-section-label">Falsification</div>
            <p>{hypothesis.falsification}</p>
          </div>
          {hypothesis.nextExperiment.description && (
            <div className="ai-section">
              <div className="ai-section-label">Next experiment</div>
              <p>{hypothesis.nextExperiment.description}</p>
            </div>
          )}
        </>
      )}

      <div className="stub-note">Stub co-scientist if no Ollama. Not for scientific use.</div>
    </div>
  );
}
