import { Activity, Files, GitBranch, Settings, Server } from "lucide-react";
import type { SidebarPanel } from "../types";

interface SideNavProps {
  activeView?: "workspace" | "terminal";
  onSelect?: (view: "workspace" | "terminal") => void;
  onOpenSettings: () => void;
  onOpenServerModal?: () => void;
  sidebarPanel?: SidebarPanel;
  onSetSidebarPanel?: (panel: SidebarPanel) => void;
  onToggleContextStatus?: () => void;
  className?: string;
}

export function SideNav({
  activeView = "workspace",
  onSelect,
  onOpenSettings,
  onOpenServerModal,
  sidebarPanel = "files",
  onSetSidebarPanel,
  onToggleContextStatus,
  className = "",
}: SideNavProps) {
  const handlePanelChange = (panel: SidebarPanel) => {
    if (onSetSidebarPanel) {
      onSetSidebarPanel(panel);
    }
    if (panel === "settings") {
      onOpenSettings();
    }
  };

  const handleContextStatusClick = () => {
    onToggleContextStatus?.();
  };

  const handleServerModalClick = () => {
    onOpenServerModal?.();
  };

  return (
    <div className={className}>
      <div className="activity-bar">
        <button
          type="button"
          className={`activity-item ${sidebarPanel === "files" ? "active" : ""}`}
          onClick={() => handlePanelChange("files")}
          title="Files"
        >
          <Files size={20} />
        </button>
        <button
          type="button"
          className={`activity-item ${sidebarPanel === "git" ? "active" : ""}`}
          onClick={() => handlePanelChange("git")}
          title="Source Control"
        >
          <GitBranch size={20} />
        </button>
        <button
          type="button"
          className={`activity-item ${sidebarPanel === "ai" ? "active" : ""}`}
          onClick={() => handlePanelChange("ai")}
          title="AI Workflow"
        >
          <Activity size={20} />
        </button>
        <div className="activity-spacer" />
        <button
          type="button"
          className="activity-item"
          onClick={handleServerModalClick}
          title="Server"
        >
          <Server size={20} />
        </button>
        <button
          type="button"
          className={`activity-item ${sidebarPanel === "settings" ? "active" : ""}`}
          onClick={() => handlePanelChange("settings")}
          title="Settings"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}
