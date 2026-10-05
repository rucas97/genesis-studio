import type { ActionId, ProjectId } from './ids';

export type ActionMode = 'play' | 'flow' | 'emergence' | 'system';
export type ActionActor = 'user' | 'ai' | 'system';

export type ActionType =
  | 'play.grab'
  | 'play.mutate'
  | 'play.splice'
  | 'play.dock'
  | 'play.simulate'
  | 'play.cut'
  | 'play.create'
  | 'play.delete'
  | 'flow.node.add'
  | 'flow.node.connect'
  | 'flow.node.configure'
  | 'flow.run.start'
  | 'flow.run.complete'
  | 'emergence.configure'
  | 'emergence.start'
  | 'emergence.detect'
  | 'emergence.intervene'
  | 'bridge.play_to_flow'
  | 'bridge.flow_to_play'
  | 'ai.hypothesis.generate'
  | 'ai.flag'
  | 'system.init'
  | 'system.migrate';

/**
 * An Action is a single event in the project.
 *
 * Every mode writes Actions. The EventLog is an ordered sequence of Actions.
 * ProjectState is a projection of the EventLog.
 *
 * Because Actions are the source of truth, Play sessions are reproducible.
 */
export interface Action {
  id: ActionId;
  projectId: ProjectId;
  mode: ActionMode;
  actor: ActionActor;
  type: ActionType;

  payload: Record<string, unknown>;
  timestamp: string;

  hash: string;
  prevHash: string;
}
