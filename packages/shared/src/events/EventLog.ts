import type { Action, EventLogId } from '../models';
import { newActionId } from '../models';

const ZERO_HASH = '0'.repeat(64);

/**
 * Append-only, hash-chained log of every action in a project.
 *
 * Properties:
 *   - Append-only: entries cannot be modified or deleted
 *   - Hash-chained: each entry includes the hash of the previous
 *   - Replayable: full state can be reconstructed from the log
 *   - Tamper-evident: any modification breaks the chain
 *
 * This is what makes an interactive session reproducible — including Play.
 */
export class EventLog {
  readonly id: EventLogId;
  readonly projectId: string;
  private actions: Action[] = [];

  constructor(id: EventLogId, projectId: string) {
    this.id = id;
    this.projectId = projectId;
  }

  get length(): number {
    return this.actions.length;
  }

  get all(): readonly Action[] {
    return this.actions;
  }

  get last(): Action | undefined {
    return this.actions[this.actions.length - 1];
  }

  async append(
    partial: Omit<Action, 'id' | 'hash' | 'prevHash'>
  ): Promise<Action> {
    const prevHash = this.last?.hash ?? ZERO_HASH;
    const id = newActionId();

    const content = {
      id,
      projectId: partial.projectId,
      mode: partial.mode,
      actor: partial.actor,
      type: partial.type,
      payload: partial.payload,
      timestamp: partial.timestamp,
      prevHash,
    };

    const hash = await sha256(canonicalize(content));
    const action: Action = { ...content, hash };
    this.actions.push(action);
    return action;
  }

  async verify(): Promise<boolean> {
    let prevHash = ZERO_HASH;
    for (const action of this.actions) {
      if (action.prevHash !== prevHash) return false;
      const content = {
        id: action.id,
        projectId: action.projectId,
        mode: action.mode,
        actor: action.actor,
        type: action.type,
        payload: action.payload,
        timestamp: action.timestamp,
        prevHash,
      };
      const expected = await sha256(canonicalize(content));
      if (expected !== action.hash) return false;
      prevHash = action.hash;
    }
    return true;
  }

  replay<S>(initial: S, reducer: (state: S, action: Action) => S): S {
    return this.actions.reduce(reducer, initial);
  }

  toJSON(): { id: EventLogId; projectId: string; actions: Action[] } {
    return { id: this.id, projectId: this.projectId, actions: this.actions };
  }

  static fromJSON(data: {
    id: EventLogId;
    projectId: string;
    actions: Action[];
  }): EventLog {
    const log = new EventLog(data.id, data.projectId);
    log.actions = [...data.actions];
    return log;
  }
}

/**
 * Stable stringification. Keys sorted, so semantically-equal objects hash equally.
 */
function canonicalize(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const subtle = (globalThis as any).crypto?.subtle;
  if (!subtle) {
    throw new Error(
      'Web Crypto API not available. Requires Node 19+, Deno, Bun, or a modern browser.'
    );
  }
  const hash = await subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
