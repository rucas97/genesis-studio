import type { CoScientist } from './types';
import { StubCoScientist } from './stub/StubCoScientist';

const scientists = new Map<string, CoScientist>();

export function registerCoScientist(s: CoScientist): void {
  scientists.set(s.name, s);
}

export function getCoScientist(name?: string): CoScientist {
  if (name) {
    const s = scientists.get(name);
    if (!s) throw new Error(`No co-scientist registered under "${name}"`);
    return s;
  }
  const first = scientists.values().next().value;
  if (!first) throw new Error('No co-scientists registered');
  return first;
}

export function listCoScientists(): CoScientist[] {
  return [...scientists.values()];
}

registerCoScientist(new StubCoScientist());
