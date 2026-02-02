import { Files, Terminal, Settings } from 'lucide-react';

type AppView = 'workspace' | 'terminal';

interface SideNavProps {
  activeView: AppView;
  onSelect: (view: AppView) => void;
  onOpenSettings: () => void;
}

export function SideNav({
  activeView,
  onSelect,
  onOpenSettings
}: SideNavProps) {
  return (
    <nav className="activity-bar">
      <div className="activity-bar-top">
        <button
          type="button"
          className={`activity-bar-item ${activeView === 'workspace' ? 'active' : ''}`}
          onClick={() => onSelect('workspace')}
          aria-label="Explorer"
          title="Explorer (Ctrl+Shift+E)"
        >
          <Files size={20} />
        </button>
        <button
          type="button"
          className={`activity-bar-item ${activeView === 'terminal' ? 'active' : ''}`}
          onClick={() => onSelect('terminal')}
          aria-label="Terminal"
          title="Terminal (Ctrl+`)"
        >
          <Terminal size={20} />
        </button>
      </div>
      <div className="activity-bar-bottom">
        <button
          type="button"
          className="activity-bar-item"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={20} />
        </button>
      </div>
    </nav>
  );
}
