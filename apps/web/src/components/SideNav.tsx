import { useState } from 'react';
import { Menu, Files, Settings, X, GitBranch, Activity } from 'lucide-react';
import type { SidebarPanel } from '../types';

interface SideNavProps {
  activeView?: 'workspace' | 'terminal';
  onSelect?: (view: 'workspace' | 'terminal') => void;
  onOpenSettings: () => void;
  sidebarPanel?: SidebarPanel;
  onSetSidebarPanel?: (panel: SidebarPanel) => void;
  onToggleContextStatus?: () => void;
}

export function SideNav({
  activeView = 'workspace',
  onSelect,
  onOpenSettings,
  sidebarPanel = 'files',
  onSetSidebarPanel,
  onToggleContextStatus
}: SideNavProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  const handlePanelChange = (panel: SidebarPanel) => {
    if (onSetSidebarPanel) {
      onSetSidebarPanel(panel);
    }
    if (panel === 'settings') {
      onOpenSettings();
    }
    closeMenu();
  };

  const handleContextStatusClick = () => {
    onToggleContextStatus?.();
    closeMenu();
  };

  return (
    <>
      {/* Hamburger Menu Button - Top Right */}
      <div className="hamburger-menu-container">
        <button
          type="button"
          className="hamburger-menu-btn"
          onClick={toggleMenu}
          aria-label="Menu"
          title="Menu"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <>
          <div className="dropdown-backdrop" onClick={closeMenu} />
          <div className="dropdown-menu">
            <div className="dropdown-header">
              <span>Menu</span>
              <button
                type="button"
                className="dropdown-close"
                onClick={closeMenu}
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>

            <div className="dropdown-section">
              <div className="dropdown-section-title">Workspace</div>
              <button
                type="button"
                className={`dropdown-item ${sidebarPanel === 'files' ? 'active' : ''}`}
                onClick={() => handlePanelChange('files')}
              >
                <Files size={16} />
                <span>Files</span>
              </button>
              <button
                type="button"
                className={`dropdown-item ${sidebarPanel === 'git' ? 'active' : ''}`}
                onClick={() => handlePanelChange('git')}
              >
                <GitBranch size={16} />
                <span>Source Control</span>
              </button>
            </div>

            <div className="dropdown-section">
              <div className="dropdown-section-title">AI</div>
              <button
                type="button"
                className={`dropdown-item ${sidebarPanel === 'ai' ? 'active' : ''}`}
                onClick={() => handlePanelChange('ai')}
              >
                <Settings size={16} />
                <span>AI Workflow</span>
              </button>
              <button
                type="button"
                className="dropdown-item"
                onClick={handleContextStatusClick}
              >
                <Activity size={16} />
                <span>Context Status</span>
              </button>
            </div>

            <div className="dropdown-section">
              <div className="dropdown-section-title">Application</div>
              <button
                type="button"
                className={`dropdown-item ${sidebarPanel === 'settings' ? 'active' : ''}`}
                onClick={() => handlePanelChange('settings')}
              >
                <Settings size={16} />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
