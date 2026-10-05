import { describe, it, expect, beforeEach } from 'vitest';
import { EventLog } from './EventLog';
import { newEventLogId, type Action } from '../models';

const PROJECT_ID = 'proj_test';
const ZERO_HASH = '0'.repeat(64);

function makeAction(
  overrides: Partial<Omit<Action, 'id' | 'hash' | 'prevHash'>> = {}
): Omit<Action, 'id' | 'hash' | 'prevHash'> {
  return {
    projectId: PROJECT_ID,
    mode: 'play',
    actor: 'user',
    type: 'play.create',
    payload: { note: 'hello' },
    timestamp: '2026-10-05T00:00:00.000Z',
    ...overrides,
  };
}

describe('EventLog', () => {
  let log: EventLog;

  beforeEach(() => {
    log = new EventLog(newEventLogId(), PROJECT_ID);
  });

  describe('append', () => {
    it('starts empty', () => {
      expect(log.length).toBe(0);
      expect(log.last).toBeUndefined();
    });

    it('appends one action and returns it', async () => {
      const action = await log.append(makeAction());
      expect(log.length).toBe(1);
      expect(action.id).toBeDefined();
      expect(action.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(action.prevHash).toBe(ZERO_HASH);
    });

    it('first action hashes the zero-hash as prevHash', async () => {
      const a1 = await log.append(makeAction());
      expect(a1.prevHash).toBe(ZERO_HASH);
    });

    it('each action chains to the previous hash', async () => {
      const a1 = await log.append(makeAction({ payload: { n: 1 } }));
      const a2 = await log.append(makeAction({ payload: { n: 2 } }));
      const a3 = await log.append(makeAction({ payload: { n: 3 } }));

      expect(a2.prevHash).toBe(a1.hash);
      expect(a3.prevHash).toBe(a2.hash);
    });

    it('assigns distinct IDs to each action', async () => {
      const a1 = await log.append(makeAction());
      const a2 = await log.append(makeAction());
      expect(a1.id).not.toBe(a2.id);
    });

    it('produces distinct hashes for distinct payloads', async () => {
      const a1 = await log.append(makeAction({ payload: { n: 1 } }));
      const a2 = await log.append(makeAction({ payload: { n: 2 } }));
      expect(a1.hash).not.toBe(a2.hash);
    });
  });

  describe('verify', () => {
    it('verifies an empty log', async () => {
      expect(await log.verify()).toBe(true);
    });

    it('verifies a single-action log', async () => {
      await log.append(makeAction());
      expect(await log.verify()).toBe(true);
    });

    it('verifies a multi-action log', async () => {
      await log.append(makeAction({ payload: { n: 1 } }));
      await log.append(makeAction({ payload: { n: 2 } }));
      await log.append(makeAction({ payload: { n: 3 } }));
      await log.append(makeAction({ payload: { n: 4 } }));
      expect(await log.verify()).toBe(true);
    });

    it('detects a tampered payload', async () => {
      await log.append(makeAction({ payload: { amount: 100 } }));
      await log.append(makeAction({ payload: { amount: 200 } }));

      // Tamper: someone changes the first action's payload.
      (log.all[0].payload as Record<string, unknown>).amount = 999;

      expect(await log.verify()).toBe(false);
    });

    it('detects a tampered timestamp', async () => {
      await log.append(makeAction());
      await log.append(makeAction());

      (log.all[1] as unknown as { timestamp: string }).timestamp =
        '2030-01-01T00:00:00.000Z';

      expect(await log.verify()).toBe(false);
    });

    it('detects a tampered hash', async () => {
      await log.append(makeAction());
      (log.all[0] as unknown as { hash: string }).hash = 'f'.repeat(64);
      expect(await log.verify()).toBe(false);
    });

    it('detects a broken chain link', async () => {
      await log.append(makeAction({ payload: { n: 1 } }));
      await log.append(makeAction({ payload: { n: 2 } }));

      (log.all[1] as unknown as { prevHash: string }).prevHash =
        'a'.repeat(64);

      expect(await log.verify()).toBe(false);
    });

    it('detects a removed action in the middle', async () => {
      await log.append(makeAction({ payload: { n: 1 } }));
      await log.append(makeAction({ payload: { n: 2 } }));
      await log.append(makeAction({ payload: { n: 3 } }));

      // Simulate deletion of the middle action.
      const tampered = [log.all[0], log.all[2]];
      const rebuilt = EventLog.fromJSON({
        id: log.id,
        projectId: PROJECT_ID,
        actions: tampered as Action[],
      });

      expect(await rebuilt.verify()).toBe(false);
    });

    it('detects reordered actions', async () => {
      await log.append(makeAction({ payload: { n: 1 } }));
      await log.append(makeAction({ payload: { n: 2 } }));
      await log.append(makeAction({ payload: { n: 3 } }));

      const reordered = [log.all[0], log.all[2], log.all[1]];
      const rebuilt = EventLog.fromJSON({
        id: log.id,
        projectId: PROJECT_ID,
        actions: reordered as Action[],
      });

      expect(await rebuilt.verify()).toBe(false);
    });
  });

  describe('canonical hashing', () => {
    it('produces the same hash regardless of key order in payload', async () => {
      const a1 = await log.append(
        makeAction({ payload: { alpha: 1, beta: 2 } })
      );

      const log2 = new EventLog(newEventLogId(), PROJECT_ID);
      const a2 = await log2.append(
        makeAction({ payload: { beta: 2, alpha: 1 } })
      );

      // Payload key order differs; content is semantically identical.
      // Hashes must match for the log to be reproducible across systems.
      expect(a1.hash).toBe(a2.hash);
    });
  });

  describe('replay', () => {
    interface Counter {
      total: number;
      kinds: string[];
    }
    const reducer = (state: Counter, action: Action): Counter => ({
      total:
        state.total + ((action.payload as { amount?: number }).amount ?? 0),
      kinds: [...state.kinds, action.type],
    });
    const initial: Counter = { total: 0, kinds: [] };

    it('replays an empty log to initial state', () => {
      const result = log.replay(initial, reducer);
      expect(result).toEqual(initial);
    });

    it('replays a log deterministically', async () => {
      await log.append(makeAction({ payload: { amount: 10 } }));
      await log.append(makeAction({ payload: { amount: 20 } }));
      await log.append(makeAction({ payload: { amount: 30 } }));

      const first = log.replay(initial, reducer);
      const second = log.replay(initial, reducer);

      expect(first.total).toBe(60);
      expect(first).toEqual(second);
    });
  });

  describe('serialization', () => {
    it('round-trips through JSON', async () => {
      await log.append(makeAction({ payload: { n: 1 } }));
      await log.append(makeAction({ payload: { n: 2 } }));
      await log.append(makeAction({ payload: { n: 3 } }));

      const json = log.toJSON();
      const restored = EventLog.fromJSON(json);

      expect(restored.length).toBe(log.length);
      expect(restored.all.map((a) => a.hash)).toEqual(
        log.all.map((a) => a.hash)
      );
      expect(await restored.verify()).toBe(true);
    });

    it('can continue appending after restore', async () => {
      await log.append(makeAction({ payload: { n: 1 } }));
      await log.append(makeAction({ payload: { n: 2 } }));

      const restored = EventLog.fromJSON(log.toJSON());
      const a3 = await restored.append(makeAction({ payload: { n: 3 } }));

      expect(a3.prevHash).toBe(restored.all[1].hash);
      expect(await restored.verify()).toBe(true);
    });
  });

  describe('the reproducibility claim', () => {
    /**
     * This test is the load-bearing one.
     *
     * Two independent EventLogs, given the same actions in the same order,
     * must produce byte-identical hash chains. If this holds, a third party
     * can reconstruct a session from the log alone.
     */
    it('two independent logs with identical actions produce identical hashes', async () => {
      const logA = new EventLog(newEventLogId(), PROJECT_ID);
      const logB = new EventLog(newEventLogId(), PROJECT_ID);

      const actions = [
        makeAction({ payload: { n: 1 }, timestamp: '2026-10-05T00:00:01.000Z' }),
        makeAction({ payload: { n: 2 }, timestamp: '2026-10-05T00:00:02.000Z' }),
        makeAction({ payload: { n: 3 }, timestamp: '2026-10-05T00:00:03.000Z' }),
      ];

      for (const a of actions) await logA.append(a);
      for (const a of actions) await logB.append(a);

      expect(logA.all.map((a) => a.hash)).toEqual(logB.all.map((a) => a.hash));
      expect(await logA.verify()).toBe(true);
      expect(await logB.verify()).toBe(true);
    });
  });
});
