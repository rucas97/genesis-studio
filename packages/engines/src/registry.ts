import type { StabilityEngine } from './types';
import { StubStabilityEngine } from './physics/StubStabilityEngine';
import {
  SidecarStabilityEngine,
  probeSidecar,
  type SidecarHealth,
} from './http/ThermoMPNNEngine';

const engines = new Map<string, StabilityEngine>();
let preferred: string | null = null;

export function registerStabilityEngine(engine: StabilityEngine): void {
  engines.set(engine.name, engine);
}

export function unregisterStabilityEngine(name: string): void {
  engines.delete(name);
  if (preferred === name) preferred = null;
}

export function setPreferredStabilityEngine(name: string | null): void {
  preferred = name;
}

export function getPreferredStabilityEngineName(): string | null {
  return preferred;
}

export function getStabilityEngine(name?: string): StabilityEngine {
  if (name) {
    const e = engines.get(name);
    if (!e) throw new Error(`No stability engine registered under "${name}"`);
    return e;
  }
  if (preferred) {
    const e = engines.get(preferred);
    if (e) return e;
  }
  const first = engines.values().next().value;
  if (!first) throw new Error('No stability engines registered');
  return first;
}

export function listStabilityEngines(): StabilityEngine[] {
  return [...engines.values()];
}

/**
 * Try to register the Python sidecar. The engine is registered under the
 * name reported by /health, so if the sidecar is running the stub runner
 * it registers as "StubRunner" — not as "ThermoMPNN" — and the UI tells
 * the truth.
 *
 * Returns the health payload if the sidecar was reachable, or null.
 */
export async function tryRegisterSidecar(
  baseUrl?: string
): Promise<SidecarHealth | null> {
  const health = await probeSidecar(baseUrl);
  if (!health) return null;
  const engine = new SidecarStabilityEngine(
    health.baseUrl,
    health.runner,
    health.version,
    health.isRealPredictor
  );
  registerStabilityEngine(engine);
  setPreferredStabilityEngine(engine.name);
  return health;
}

// Legacy name for compatibility.
export { tryRegisterSidecar as tryRegisterThermoMPNN };

// Stub is always registered so the demo works offline.
registerStabilityEngine(new StubStabilityEngine());
