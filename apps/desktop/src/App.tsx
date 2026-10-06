import { useState, type ReactNode } from 'react';
import { ProjectProvider, useProject, type Tab } from './state/ProjectContext';
import { PlayTab } from './tabs/PlayTab';
import { FlowTab } from './tabs/FlowTab';
import { EmergenceTab } from './tabs/EmergenceTab';
import { SessionLogPanel } from './panels/SessionLogPanel';

export function App() {
  return (
    <ProjectProvider>
      <Shell />
    </ProjectProvider>
  );
}

function Shell() {
  const {
    activeTab, setActiveTab, actionCount, logVerified, verifyLog, log,
  } = useProject();
  const [logOpen, setLogOpen] = useState(false);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">GENESIS Studio</div>
        <nav className="tabs">
          <TabButton active={activeTab === 'play'} onClick={() => setActiveTab('play')}>Play</TabButton>
          <TabButton active={activeTab === 'flow'} onClick={() => setActiveTab('flow')}>Flow</TabButton>
          <TabButton active={activeTab === 'emergence'} onClick={() => setActiveTab('emergence')}>Emergence</TabButton>
        </nav>
        <div className="topbar-right">
          <button className="log-toggle" onClick={() => setLogOpen((v) => !v)}>
            {logOpen ? 'Hide log' : 'Show log'}
          </button>
          <span className="action-count">
            {actionCount} action{actionCount === 1 ? '' : 's'}
          </span>
          {logVerified !== null && (
            <span className={logVerified ? 'ok' : 'bad'}>
              {logVerified ? '✓ chain intact' : '✗ chain broken'}
            </span>
          )}
          <button className="link" disabled={actionCount === 0} onClick={verifyLog}>Verify</button>
          <span className="badge">Research-use-only</span>
        </div>
      </header>
      <main className="content">
        {activeTab === 'play' && <PlayTab />}
        {activeTab === 'flow' && <FlowTab />}
        {activeTab === 'emergence' && <EmergenceTab />}
      </main>
      {logOpen && (
        <div className="log-drawer">
          <SessionLogPanel
            log={log}
            actionCount={actionCount}
            defaultPdbId="4HJO"
            defaultProteinId="egfr"
          />
        </div>
      )}
    </div>
  );
}

function TabButton({
  active, disabled, onClick, children,
}: {
  active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode;
}) {
  return (
    <button className={`tab ${active ? 'active' : ''}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
