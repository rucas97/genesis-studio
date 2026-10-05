import type { StabilityEngine } from './types';
import { StubStabilityEngine } from './physics/StubStabilityEngine';

const engines = new Map<string, StabilityEngine>();

export function registerStabilityEngine(engine: StabilityEngine): void {
  engines.set(engine.name, engine);
}

export function getStabilityEngine(name?: string): StabilityEngine {
  if (name) {
    const e = engines.get(name);
    if (!e) throw new Error(`No stability engine registered under "${name}"`);
    return e;
  }
  const first = engines.values().next().value;
  if (!first) throw new Error('No stability engines registered');
  return first;
}

export function listStabilityEngines(): StabilityEngine[] {
  return [...engines.values()];
}

registerStabilityEngine(new StubStabilityEngine());
