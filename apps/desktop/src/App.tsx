import { useState, type ReactNode } from 'react';
import { PlayTab } from './tabs/PlayTab';
import { FlowTab } from './tabs/FlowTab';
import { EmergenceTab } from './tabs/EmergenceTab';

type Tab = 'play' | 'flow' | 'emergence';

export function App() {
  const [tab, setTab] = useState<Tab>('play');

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">GENESIS Studio</div>
        <nav className="tabs">
          <TabButton active={tab === 'play'} onClick={() => setTab('play')}>
            Play
          </TabButton>
          <TabButton active={tab === 'flow'} onClick={() => setTab('flow')}>
            Flow
          </TabButton>
          <TabButton
            active={tab === 'emergence'}
            disabled
            onClick={() => setTab('emergence')}
          >
            Emergence
          </TabButton>
        </nav>
        <div className="badge">Research-use-only</div>
      </header>
      <main className="content">
        {tab === 'play' && <PlayTab />}
        {tab === 'flow' && <FlowTab />}
        {tab === 'emergence' && <EmergenceTab />}
      </main>
    </div>
  );
}

function TabButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`tab ${active ? 'active' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
