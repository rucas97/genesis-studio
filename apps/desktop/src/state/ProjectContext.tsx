import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  EventLog,
  newEventLogId,
  newProjectId,
  type Molecule,
  type Project,
  type ProjectId,
  type Variant,
} from '@genesis/shared';

export type Tab = 'play' | 'flow' | 'emergence';

export interface SendToPlayPayload {
  variant: Variant;
  molecule: Molecule;
}

export interface ProjectContextValue {
  project: Project;
  projectId: ProjectId;
  log: EventLog;
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  pendingSendToPlay: SendToPlayPayload | null;
  sendToPlay: (payload: SendToPlayPayload) => void;
  clearPendingSendToPlay: () => void;
  actionCount: number;
  refreshActionCount: () => void;
  logVerified: boolean | null;
  verifyLog: () => Promise<void>;
}

const Ctx = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const projectId = useMemo(() => newProjectId(), []);
  const logRef = useRef<EventLog | null>(null);
  if (!logRef.current) logRef.current = new EventLog(newEventLogId(), projectId);
  const log = logRef.current;

  const project = useMemo<Project>(
    () => ({
      id: projectId,
      name: 'Untitled project',
      description: '',
      owner: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      moleculeIds: [],
      variantIds: [],
      runIds: [],
      hypothesisIds: [],
      eventLogId: log.id,
      schemaVersion: 1,
    }),
    [projectId, log.id]
  );

  const [activeTab, setActiveTabState] = useState<Tab>('play');
  const [pendingSendToPlay, setPending] = useState<SendToPlayPayload | null>(null);
  const [actionCount, setActionCount] = useState(0);
  const [logVerified, setLogVerified] = useState<boolean | null>(null);

  const refreshActionCount = useCallback(() => {
    setActionCount(log.length);
  }, [log]);

  const setActiveTab = useCallback((t: Tab) => {
    setActiveTabState(t);
  }, []);

  const sendToPlay = useCallback((payload: SendToPlayPayload) => {
    setPending(payload);
    setActiveTabState('play');
  }, []);

  const clearPendingSendToPlay = useCallback(() => {
    setPending(null);
  }, []);

  const verifyLog = useCallback(async () => {
    const ok = await log.verify();
    setLogVerified(ok);
    setActionCount(log.length);
  }, [log]);

  const value: ProjectContextValue = {
    project,
    projectId,
    log,
    activeTab,
    setActiveTab,
    pendingSendToPlay,
    sendToPlay,
    clearPendingSendToPlay,
    actionCount,
    refreshActionCount,
    logVerified,
    verifyLog,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProject(): ProjectContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProject must be used inside <ProjectProvider>');
  return v;
}
