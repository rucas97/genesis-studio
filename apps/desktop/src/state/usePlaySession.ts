import { useCallback, useMemo, useRef, useState } from 'react';
import {
  newMoleculeId, newVariantId,
  type EventLog, type Hypothesis, type Molecule, type ProjectId, type Variant,
} from '@genesis/shared';
import { getStabilityEngine, type StabilityPrediction } from '@genesis/engines';
import { getCoScientist, type Observation } from '@genesis/ai';

export interface PickedResidue {
  index: number;
  residueNumber: number;
  residueOneLetter: string;
  atom: { x: number; y: number; z: number };
}
export type SessionStatus = 'idle' | 'predicting' | 'done' | 'error';

export interface PlaySession {
  molecule: Molecule;
  picked: PickedResidue | null;
  variant: Variant | null;
  prediction: StabilityPrediction | null;
  observation: Observation | null;
  hypothesis: Hypothesis | null;
  status: SessionStatus;
  error: string | null;
  pickResidue(picked: PickedResidue | null): void;
  mutate(newResidue: string): Promise<void>;
  bridgeIn(variant: Variant, molecule: Molecule): Promise<void>;
  setBindingResult(obs: Observation, hyp: Hypothesis): void;
}

export interface PlaySessionOptions {
  log: EventLog;
  projectId: ProjectId;
  pdbId: string;
  proteinName: string;
  geneName: string;
}

export function usePlaySession(options: PlaySessionOptions): PlaySession {
  const { log, projectId, pdbId, proteinName, geneName } = options;

  const molecule = useMemo<Molecule>(
    () => ({
      id: newMoleculeId(), projectId,
      kind: 'protein', name: proteinName,
      description: `${geneName} · ${pdbId}`,
      sequence: '',
      structure: { kind: 'pdb', pdbId },
      variantIds: [], createdIn: 'play',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    [projectId, pdbId, proteinName, geneName]
  );

  const [picked, setPicked] = useState<PickedResidue | null>(null);
  const [variant, setVariant] = useState<Variant | null>(null);
  const [prediction, setPrediction] = useState<StabilityPrediction | null>(null);
  const [observation, setObservation] = useState<Observation | null>(null);
  const [hypothesis, setHypothesis] = useState<Hypothesis | null>(null);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const pickResidue = useCallback((p: PickedResidue | null) => {
    setPicked(p);
    setVariant(null); setPrediction(null);
    setObservation(null); setHypothesis(null);
    setStatus('idle'); setError(null);
  }, []);

  const runPrediction = useCallback(
    async (v: Variant, m: Molecule, source: 'user' | 'bridge') => {
      setStatus('predicting'); setError(null);
      try {
        await log.append({
          projectId, mode: 'play', actor: 'user', type: 'play.mutate',
          payload: { variant: v, moleculeId: m.id, source },
          timestamp: new Date().toISOString(),
        });
        const engine = getStabilityEngine();
        const result = await engine.predictStability({ molecule: m, variant: v });
        setPrediction(result); setVariant(v);
        const ai = getCoScientist();
        const obs = await ai.observe({ projectId, molecule: m, variant: v, predictions: [result] });
        setObservation(obs);
        const hyp = await ai.hypothesize({ projectId, molecule: m, variant: v, predictions: [result] });
        setHypothesis(hyp);
        await log.append({
          projectId, mode: 'play', actor: 'ai', type: 'ai.hypothesis.generate',
          payload: { hypothesis: hyp, observation: obs },
          timestamp: new Date().toISOString(),
        });
        setStatus('done');
      } catch (e) {
        setStatus('error');
        setError(String((e as Error)?.message ?? e));
      }
    },
    [log, projectId]
  );

  const mutate = useCallback(async (newResidue: string) => {
    if (!picked) return;
    const from = picked.residueOneLetter;
    const to = newResidue.toUpperCase();
    const newVariant: Variant = {
      id: newVariantId(), projectId,
      parentMoleculeId: molecule.id,
      kind: 'substitution', origin: 'synthetic',
      hgvs: `p.${from}${picked.residueNumber}${to}`,
      position: picked.residueNumber, ref: from, alt: to,
      predictions: [], createdIn: 'play',
      createdAt: new Date().toISOString(),
    };
    await runPrediction(newVariant, molecule, 'user');
  }, [picked, molecule, projectId, runPrediction]);

  const bridgeIn = useCallback(async (v: Variant, m: Molecule) => {
    setPicked({
      index: -1,
      residueNumber: v.position ?? 0,
      residueOneLetter: v.ref ?? '?',
      atom: { x: 0, y: 0, z: 0 },
    });
    await runPrediction(v, m, 'bridge');
  }, [runPrediction]);

  const setBindingResult = useCallback((obs: Observation, hyp: Hypothesis) => {
    setObservation(obs);
    setHypothesis(hyp);
  }, []);

  return {
    molecule, picked, variant, prediction, observation, hypothesis,
    status, error,
    pickResidue, mutate, bridgeIn, setBindingResult,
  };
}
