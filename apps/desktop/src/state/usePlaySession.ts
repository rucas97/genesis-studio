import { useCallback, useMemo, useRef, useState } from 'react';
import {
  EventLog,
  newEventLogId,
  newMoleculeId,
  newProjectId,
  newVariantId,
  type Hypothesis,
  type Molecule,
  type ProjectId,
  type Variant,
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
  projectId: ProjectId;
  picked: PickedResidue | null;
  variant: Variant | null;
  prediction: StabilityPrediction | null;
  observation: Observation | null;
  hypothesis: Hypothesis | null;
  status: SessionStatus;
  error: string | null;
  actionCount: number;
  logVerified: boolean | null;
  pickResidue(picked: PickedResidue | null): void;
  mutate(newResidue: string): Promise<void>;
  reset(): void;
  verifyLog(): Promise<void>;
}

export interface PlaySessionOptions {
  pdbId: string;
  proteinName: string;
  geneName: string;
}

export function usePlaySession(options: PlaySessionOptions): PlaySession {
  const projectId = useMemo(() => newProjectId(), []);
  const logRef = useRef<EventLog | null>(null);
  if (!logRef.current) logRef.current = new EventLog(newEventLogId(), projectId);

  const molecule = useMemo<Molecule>(
    () => ({
      id: newMoleculeId(),
      projectId,
      kind: 'protein',
      name: options.proteinName,
      description: `${options.geneName} · ${options.pdbId}`,
      sequence: '',
      structure: { kind: 'pdb', pdbId: options.pdbId },
      variantIds: [],
      createdIn: 'play',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    [projectId, options.pdbId, options.proteinName, options.geneName]
  );

  const [picked, setPicked] = useState<PickedResidue | null>(null);
  const [variant, setVariant] = useState<Variant | null>(null);
  const [prediction, setPrediction] = useState<StabilityPrediction | null>(null);
  const [observation, setObservation] = useState<Observation | null>(null);
  const [hypothesis, setHypothesis] = useState<Hypothesis | null>(null);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [actionCount, setActionCount] = useState(0);
  const [logVerified, setLogVerified] = useState<boolean | null>(null);

  const pickResidue = useCallback((p: PickedResidue | null) => {
    setPicked(p);
    setVariant(null);
    setPrediction(null);
    setObservation(null);
    setHypothesis(null);
    setStatus('idle');
    setError(null);
    setLogVerified(null);
  }, []);

  const mutate = useCallback(
    async (newResidue: string) => {
      if (!picked) return;
      const log = logRef.current!;
      setStatus('predicting');
      setError(null);

      try {
        const from = picked.residueOneLetter;
        const to = newResidue.toUpperCase();
        const hgvs = `p.${from}${picked.residueNumber}${to}`;

        const newVariant: Variant = {
          id: newVariantId(),
          projectId,
          parentMoleculeId: molecule.id,
          kind: 'substitution',
          origin: 'synthetic',
          hgvs,
          position: picked.residueNumber,
          ref: from,
          alt: to,
          predictions: [],
          createdIn: 'play',
          createdAt: new Date().toISOString(),
        };

        await log.append({
          projectId,
          mode: 'play',
          actor: 'user',
          type: 'play.mutate',
          payload: { variant: newVariant, moleculeId: molecule.id },
          timestamp: new Date().toISOString(),
        });

        const engine = getStabilityEngine();
        const result = await engine.predictStability({ molecule, variant: newVariant });
        setPrediction(result);
        setVariant(newVariant);

        const ai = getCoScientist();
        const obs = await ai.observe({
          projectId, molecule, variant: newVariant, predictions: [result],
        });
        setObservation(obs);

        const hyp = await ai.hypothesize({
          projectId, molecule, variant: newVariant, predictions: [result],
        });
        setHypothesis(hyp);

        await log.append({
          projectId,
          mode: 'play',
          actor: 'ai',
          type: 'ai.hypothesis.generate',
          payload: { hypothesis: hyp, observation: obs },
          timestamp: new Date().toISOString(),
        });

        setActionCount(log.length);
        setStatus('done');
      } catch (e) {
        setStatus('error');
        setError(String((e as Error)?.message ?? e));
      }
    },
    [picked, molecule, projectId]
  );

  const reset = useCallback(() => {
    pickResidue(null);
    setLogVerified(null);
  }, [pickResidue]);

  const verifyLog = useCallback(async () => {
    const log = logRef.current!;
    const ok = await log.verify();
    setLogVerified(ok);
    setActionCount(log.length);
  }, []);

  return {
    molecule, projectId, picked, variant, prediction, observation, hypothesis,
    status, error, actionCount, logVerified,
    pickResidue, mutate, reset, verifyLog,
  };
}
