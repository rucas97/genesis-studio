import type {
  CoScientist, CoScientistCapabilities, CoScientistInput, Observation,
} from '../types';
import type { Hypothesis } from '@genesis/shared';
import { newHypothesisId } from '@genesis/shared';

const CAPABILITIES: CoScientistCapabilities = {
  canObserve: true,
  canHypothesize: true,
  canProposeExperiment: true,
  runsLocally: true,
  approximateLatencyMs: 50,
  validationScope:
    'STUB — deterministic templates, no LLM, no literature grounding. Demo-only. Not for scientific use.',
};

function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function range(h: number, lo: number, hi: number): number {
  const t = (h % 10000) / 10000;
  return lo + t * (hi - lo);
}

export class StubCoScientist implements CoScientist {
  readonly name = 'StubCoScientist';
  readonly version = '0.0.1';

  capabilities(): CoScientistCapabilities { return CAPABILITIES; }

  async observe(input: CoScientistInput): Promise<Observation> {
    const { predictions, variant, molecule, binding } = input;
    const count = predictions.length;
    const destabilizing = predictions.filter((p) => p.deltaDeltaG < -1).length;
    const agreement = count === 0 ? 0 : destabilizing / count;
    const meanDDG = count === 0 ? 0 : predictions.reduce((s, p) => s + p.deltaDeltaG, 0) / count;

    const h = hash32(`${molecule.name}|${variant.hgvs}|${binding?.ligandName ?? ''}`);
    const confidence = Number(range(h, 0.6, 0.95).toFixed(2));

    const flags: string[] = [];
    if (count >= 3 && agreement >= 0.75) flags.push('methods_agree');
    if (count < 2) flags.push('insufficient_methods');
    if (meanDDG < -3) flags.push('strongly_destabilizing');
    if (binding) {
      if (binding.distanceAngstrom < 4.5) flags.push('close_contact');
      if (binding.estimatedKdNm < 100) flags.push('tight_binder');
      else if (binding.estimatedKdNm > 10000) flags.push('weak_binder');
    }

    let summary = `${variant.hgvs} on ${molecule.name}: mean ΔΔG ${meanDDG.toFixed(2)} kcal/mol across ${count} method${count === 1 ? '' : 's'}.`;
    if (binding) {
      summary += ` ${binding.ligandName} at ${binding.distanceAngstrom.toFixed(2)} Å, estimated Kd ${binding.estimatedKdNm < 1000 ? `${binding.estimatedKdNm.toFixed(0)} nM` : `${(binding.estimatedKdNm / 1000).toFixed(1)} µM`}.`;
    }

    return { summary, agreement, confidence, flags, notes: 'Stub observation. Not for scientific use.' };
  }

  async hypothesize(input: CoScientistInput): Promise<Hypothesis> {
    const obs = await this.observe(input);
    const { binding, variant, molecule } = input;

    let claim = `${variant.hgvs} alters the stability of ${molecule.name}.`;
    let mechanism = 'Stub mechanism. Real mechanistic reasoning requires a language model with literature retrieval.';
    let nextExperiment = 'Express the variant, purify, run DSF against a wild-type control.';
    const predictions: Array<{ type: any; test: string; expected: string }> = [
      { type: 'biophysical', test: 'Thermal shift assay (DSF)',
        expected: 'Tm change consistent with the predicted ΔΔG, within the reported confidence interval.' },
    ];

    if (binding) {
      const strength = binding.estimatedKdNm < 100 ? 'high-affinity'
        : binding.estimatedKdNm < 1000 ? 'moderate-affinity' : 'weak';
      claim = `${binding.ligandName} forms a ${strength} contact with ${molecule.name} near ${variant.hgvs}.`;
      mechanism = `Geometry-based stub. The ligand sits ${binding.distanceAngstrom.toFixed(2)} Å from the selected residue. Estimated Kd ${binding.estimatedKdNm.toFixed(0)} nM. Real docking and MD are required to validate.`;
      predictions.push({
        type: 'biophysical',
        test: 'Isothermal titration calorimetry (ITC)',
        expected: `Measured Kd within an order of magnitude of ${binding.estimatedKdNm.toFixed(0)} nM.`,
      });
      nextExperiment = `Express and purify ${molecule.name}, run ITC with ${binding.ligandName}, compare to a matched wild-type control.`;
    }

    return {
      id: newHypothesisId(),
      projectId: input.projectId,
      source: 'play',
      claim,
      mechanism,
      predictions,
      uncertainty: {
        confidence: obs.confidence,
        methodAgreement: obs.agreement,
        trainingDistribution: 'unknown',
        physicalPlausibility: binding && binding.distanceAngstrom < 1.5 ? 'questionable' : 'valid',
        notes: 'Stub uncertainty. Real calibration requires validated methods.',
      },
      evidence: {
        methodsAgreeing: [],
        methodsDisagreeing: [],
        literatureStatus: 'not checked (stub)',
        novelty: 'unknown',
      },
      falsification: binding
        ? `If ITC shows no measurable binding or Kd differs by more than 100-fold from ${binding.estimatedKdNm.toFixed(0)} nM, this hypothesis is wrong.`
        : 'If DSF shows a Tm change inconsistent with the predicted ΔΔG, this hypothesis is wrong.',
      nextExperiment: { description: nextExperiment },
      derivedFromRunIds: [],
      createdAt: new Date().toISOString(),
    };
  }
}
