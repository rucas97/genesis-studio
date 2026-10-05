import type { CoScientist } from './types';
import { StubCoScientist } from './stub/StubCoScientist';
import {
  OllamaCoScientist,
  probeOllama,
  type OllamaHealth,
} from './ollama/OllamaCoScientist';

const scientists = new Map<string, CoScientist>();
let preferred: string | null = null;

export function registerCoScientist(s: CoScientist): void {
  scientists.set(s.name, s);
}

export function setPreferredCoScientist(name: string | null): void {
  preferred = name;
}

export function getCoScientist(name?: string): CoScientist {
  if (name) {
    const s = scientists.get(name);
    if (!s) throw new Error(`No co-scientist registered under "${name}"`);
    return s;
  }
  if (preferred) {
    const s = scientists.get(preferred);
    if (s) return s;
  }
  const first = scientists.values().next().value;
  if (!first) throw new Error('No co-scientists registered');
  return first;
}

export function listCoScientists(): CoScientist[] {
  return [...scientists.values()];
}

export async function tryRegisterOllama(
  baseUrl?: string
): Promise<OllamaHealth | null> {
  const health = await probeOllama(baseUrl);
  if (!health) return null;
  const cs = new OllamaCoScientist(health.baseUrl, health.chosenModel);
  registerCoScientist(cs);
  setPreferredCoScientist(cs.name);
  return health;
}

// Stub is always registered so the app works offline.
registerCoScientist(new StubCoScientist());
